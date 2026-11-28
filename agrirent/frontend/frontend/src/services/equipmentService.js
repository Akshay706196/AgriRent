import { equipmentApi } from './apiClient';

export const equipmentService = {
  /**
   * Searches and filters publicly listed active equipment.
   * Endpoint: GET /api/v1/equipment
   */
  async searchEquipment(params = {}) {
    const response = await equipmentApi.get('/api/v1/equipment', { params });
    // Returns { data: [...], pagination: { total, page, limit, pages } }
    return response.data;
  },

  /**
   * Retrieves single equipment listing by ID.
   * Endpoint: GET /api/v1/equipment/:equipmentId
   */
  async getEquipmentById(equipmentId) {
    const response = await equipmentApi.get(`/api/v1/equipment/${encodeURIComponent(equipmentId)}`);
    return response.data;
  },

  /**
   * Creates new equipment listing (Owner only).
   * Endpoint: POST /api/v1/equipment
   */
  async createEquipment(payload) {
    const response = await equipmentApi.post('/api/v1/equipment', payload);
    return response.data;
  },

  /**
   * Updates existing equipment listing (Owner only).
   * Endpoint: PATCH /api/v1/equipment/:equipmentId
   */
  async updateEquipment(equipmentId, payload) {
    const response = await equipmentApi.patch(`/api/v1/equipment/${encodeURIComponent(equipmentId)}`, payload);
    return response.data;
  },

  /**
   * Soft-deletes / deactivates an equipment listing (Owner only).
   * Endpoint: DELETE /api/v1/equipment/:equipmentId
   */
  async deleteEquipment(equipmentId) {
    const response = await equipmentApi.delete(`/api/v1/equipment/${encodeURIComponent(equipmentId)}`);
    return response.data;
  },

  /**
   * Checks equipment availability for specific dates.
   * Endpoint: GET /api/v1/equipment/:equipmentId/availability
   */
  async checkAvailability(equipmentId, startDate, endDate) {
    const response = await equipmentApi.get(`/api/v1/equipment/${encodeURIComponent(equipmentId)}/availability`, {
      params: { startDate, endDate },
    });
    return response.data;
  },
};
