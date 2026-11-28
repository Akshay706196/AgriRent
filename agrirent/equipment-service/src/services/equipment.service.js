const axios = require('axios');
const Equipment = require('../models/Equipment');
const ApiError = require('../utils/ApiError');

const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || 'http://localhost:4002';
const HTTP_TIMEOUT_MS = 5000;

class EquipmentService {
  /**
   * Creates a new equipment listing.
   */
  async createEquipment(ownerId, data) {
    // Derive ownerId strictly from authenticated user
    const equipmentData = {
      ...data,
      ownerId,
      status: data.status || 'ACTIVE',
      isDeleted: false,
    };

    const equipment = await Equipment.create(equipmentData);
    return equipment;
  }

  /**
   * Retrieves an equipment listing by its unique identifier.
   */
  async getEquipmentById(equipmentId) {
    const query = {
      $or: [{ equipmentId }, { _id: equipmentId.match(/^[0-9a-fA-F]{24}$/) ? equipmentId : null }],
      isDeleted: false,
    };

    const equipment = await Equipment.findOne(query);
    if (!equipment) {
      throw new ApiError(404, 'EQUIPMENT_NOT_FOUND', `Equipment listing '${equipmentId}' does not exist or has been removed.`);
    }

    return equipment;
  }

  /**
   * Updates an existing equipment listing (Owner only).
   */
  async updateEquipment(equipmentId, requesterId, updateData) {
    const equipment = await this.getEquipmentById(equipmentId);

    if (equipment.ownerId !== requesterId) {
      throw new ApiError(403, 'NOT_EQUIPMENT_OWNER', 'You are not authorized to modify this equipment listing.');
    }

    // Normalized copy of updateData
    const normalizedData = { ...updateData };

    // Support client aliases
    if (normalizedData.title && !normalizedData.name) {
      normalizedData.name = normalizedData.title;
    }
    if (normalizedData.images && !normalizedData.photos) {
      normalizedData.photos = Array.isArray(normalizedData.images) ? normalizedData.images : [normalizedData.images];
    }
    if (normalizedData.yearOfManufacture && !normalizedData.manufacturingYear) {
      normalizedData.manufacturingYear = parseInt(normalizedData.yearOfManufacture, 10);
    }
    if (normalizedData.location && !normalizedData.pickupAddress && normalizedData.location.city) {
      normalizedData.pickupAddress = {
        address: normalizedData.location.address || equipment.pickupAddress?.address || 'Pickup Point',
        city: normalizedData.location.city,
        state: normalizedData.location.state || equipment.pickupAddress?.state || '',
        postalCode: normalizedData.location.postalCode || normalizedData.location.pincode || equipment.pickupAddress?.postalCode || '',
      };
    }
    if (normalizedData.status) {
      const st = normalizedData.status.toUpperCase();
      if (st === 'AVAILABLE') normalizedData.status = 'ACTIVE';
      else if (st === 'UNDER_MAINTENANCE') normalizedData.status = 'MAINTENANCE';
      else normalizedData.status = st;
    }
    if (normalizedData.condition) {
      const cond = normalizedData.condition.toUpperCase();
      if (cond === 'EXCELLENT') normalizedData.condition = 'NEW';
      else normalizedData.condition = cond;
    }
    if (normalizedData.category) {
      const cat = normalizedData.category.toUpperCase();
      if (cat === 'SEED_DRILL') normalizedData.category = 'SEEDER';
      else if (['SPRAYER', 'TILLER'].includes(cat)) normalizedData.category = 'OTHER';
      else normalizedData.category = cat;
    }

    // Whitelist allowed fields for update
    const allowedFields = [
      'name',
      'category',
      'description',
      'brand',
      'model',
      'manufacturingYear',
      'condition',
      'photos',
      'pricePerDay',
      'securityDeposit',
      'pickupAddress',
      'location',
      'termsAndConditions',
      'status',
    ];

    allowedFields.forEach((field) => {
      if (normalizedData[field] !== undefined) {
        equipment[field] = normalizedData[field];
      }
    });

    await equipment.save();
    return equipment;
  }

  /**
   * Soft-deletes / deactivates an equipment listing (Owner only).
   * Checks with Booking Service to ensure no active bookings exist.
   */
  async deleteEquipment(equipmentId, requesterId, correlationId = 'internal') {
    const equipment = await this.getEquipmentById(equipmentId);

    if (equipment.ownerId !== requesterId) {
      throw new ApiError(403, 'NOT_EQUIPMENT_OWNER', 'You are not authorized to delete this equipment listing.');
    }

    // Verify with Booking Service that equipment does not have active/pending reservations
    try {
      const response = await axios.get(
        `${BOOKING_SERVICE_URL}/api/v1/bookings/availability`,
        {
          params: {
            equipmentId: equipment.equipmentId,
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          },
          headers: { 'x-correlation-id': correlationId },
          timeout: HTTP_TIMEOUT_MS,
        }
      );

      if (response.data && response.data.conflictingBookingsCount > 0) {
        throw new ApiError(
          409,
          'EQUIPMENT_HAS_ACTIVE_BOOKINGS',
          'Cannot delete equipment listing because it has active or pending bookings.'
        );
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
      // If booking service returns 409 or business error
      if (err.response && err.response.status === 409) {
        throw new ApiError(
          409,
          'EQUIPMENT_HAS_ACTIVE_BOOKINGS',
          'Cannot delete equipment listing because it has active or pending bookings.'
        );
      }
      // If Booking Service is unreachable in production, log safe warning
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[Equipment Service] Could not reach Booking Service to verify reservations: ${err.message}`);
      }
    }

    // Soft deletion
    equipment.status = 'INACTIVE';
    equipment.isDeleted = true;
    await equipment.save();

    return {
      message: 'Equipment listing successfully deactivated.',
      equipmentId: equipment.equipmentId,
    };
  }

  /**
   * Retrieves all equipment listings belonging to the authenticated owner.
   */
  async getMyEquipment(ownerId, queryParams = {}) {
    const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(queryParams.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = {
      ownerId,
      isDeleted: false,
    };

    if (queryParams.status && queryParams.status.toUpperCase() !== 'ALL') {
      const st = queryParams.status.toUpperCase();
      filter.status = st === 'AVAILABLE' ? 'ACTIVE' : st;
    }

    if (queryParams.category) {
      let cat = queryParams.category.toUpperCase();
      if (cat === 'SEED_DRILL') cat = 'SEEDER';
      else if (['SPRAYER', 'TILLER'].includes(cat)) cat = 'OTHER';
      filter.category = cat;
    }

    const search = queryParams.search || queryParams.q;
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { brand: searchRegex },
        { model: searchRegex },
        { equipmentId: searchRegex },
      ];
    }

    const [data, total] = await Promise.all([
      Equipment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Equipment.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Searches and filters equipment listings.
   */
  async searchEquipment(queryParams) {
    const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(queryParams.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = {
      isDeleted: false,
    };

    // Support ownerId filter
    if (queryParams.ownerId) {
      filter.ownerId = queryParams.ownerId;
    }

    // Status filter: defaults to ACTIVE for public browsing; handles 'AVAILABLE' alias and 'ALL'
    if (queryParams.status) {
      const statusUpper = queryParams.status.toUpperCase();
      if (statusUpper === 'AVAILABLE') {
        filter.status = 'ACTIVE';
      } else if (statusUpper !== 'ALL') {
        filter.status = statusUpper;
      }
    } else {
      filter.status = 'ACTIVE';
    }

    // Text search query across name, description, brand, model, and equipmentId
    const search = queryParams.search || queryParams.q;
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { brand: searchRegex },
        { model: searchRegex },
        { equipmentId: searchRegex },
      ];
    }

    if (queryParams.category) {
      let cat = queryParams.category.toUpperCase();
      if (cat === 'SEED_DRILL') cat = 'SEEDER';
      else if (['SPRAYER', 'TILLER'].includes(cat)) cat = 'OTHER';
      filter.category = cat;
    }

    if (queryParams.condition) {
      let cond = queryParams.condition.toUpperCase();
      if (cond === 'EXCELLENT') cond = 'NEW';
      filter.condition = cond;
    }

    if (queryParams.city) {
      filter['pickupAddress.city'] = new RegExp(queryParams.city.trim(), 'i');
    }

    if (queryParams.state) {
      filter['pickupAddress.state'] = new RegExp(queryParams.state.trim(), 'i');
    }

    if (queryParams.minPrice || queryParams.maxPrice) {
      filter.pricePerDay = {};
      if (queryParams.minPrice) filter.pricePerDay.$gte = Number(queryParams.minPrice);
      if (queryParams.maxPrice) filter.pricePerDay.$lte = Number(queryParams.maxPrice);
    }

    // Sorting
    let sortObj = { createdAt: -1 };
    if (queryParams.sortBy === 'price_asc') {
      sortObj = { pricePerDay: 1 };
    } else if (queryParams.sortBy === 'price_desc') {
      sortObj = { pricePerDay: -1 };
    }

    const [data, total] = await Promise.all([
      Equipment.find(filter).sort(sortObj).skip(skip).limit(limit),
      Equipment.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Delegates authoritative availability checking to Booking Service.
   */
  async checkAvailability(equipmentId, startDate, endDate, correlationId = 'internal') {
    const equipment = await this.getEquipmentById(equipmentId);

    if (equipment.status !== 'ACTIVE') {
      return {
        equipmentId: equipment.equipmentId,
        startDate,
        endDate,
        available: false,
        reason: `Equipment status is ${equipment.status}`,
      };
    }

    try {
      const response = await axios.get(
        `${BOOKING_SERVICE_URL}/api/v1/bookings/availability`,
        {
          params: {
            equipmentId: equipment.equipmentId,
            startDate,
            endDate,
          },
          headers: { 'x-correlation-id': correlationId },
          timeout: HTTP_TIMEOUT_MS,
        }
      );

      return {
        equipmentId: equipment.equipmentId,
        startDate,
        endDate,
        available: response.data.available,
      };
    } catch (err) {
      if (err.response) {
        throw new ApiError(
          err.response.status,
          err.response.data?.error?.code || 'DEPENDENCY_ERROR',
          err.response.data?.error?.message || 'Downstream Booking Service error'
        );
      }
      throw new ApiError(
        503,
        'DEPENDENCY_UNAVAILABLE',
        'Booking Service is currently unreachable to verify authoritative date availability.'
      );
    }
  }
}

module.exports = new EquipmentService();
