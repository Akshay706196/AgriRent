/**
 * Ajv JSON Schemas for AgriRent Handover, Return & Late-Fine Service.
 */

const generatePinSchema = {
  params: {
    type: 'object',
    required: ['bookingId'],
    properties: {
      bookingId: {
        type: 'string',
        minLength: 3,
        maxLength: 64,
      },
    },
    additionalProperties: false,
  },
};

const verifyPinSchema = {
  params: {
    type: 'object',
    required: ['bookingId'],
    properties: {
      bookingId: {
        type: 'string',
        minLength: 3,
        maxLength: 64,
      },
    },
    additionalProperties: false,
  },
  body: {
    type: 'object',
    required: ['pin'],
    properties: {
      pin: {
        type: 'string',
        pattern: '^[0-9]{6}$',
        description: 'Single-use 6-digit numeric PIN',
      },
      conditionReport: {
        type: 'object',
        properties: {
          engineHours: { type: 'number', minimum: 0 },
          fuelLevelPercent: { type: 'integer', minimum: 0, maximum: 100 },
          cleanliness: { type: 'string', enum: ['EXCELLENT', 'GOOD', 'FAIR', 'DIRTY'] },
          visualInspectionNotes: { type: 'string', maxLength: 1000 },
          photoUrls: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 10,
          },
        },
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  },
};

const lateFineSchema = {
  params: {
    type: 'object',
    required: ['bookingId'],
    properties: {
      bookingId: {
        type: 'string',
        minLength: 3,
        maxLength: 64,
      },
    },
    additionalProperties: false,
  },
  query: {
    type: 'object',
    properties: {
      returnTime: {
        type: 'string',
        format: 'date-time',
        description: 'Optional ISO 8601 timestamp for late fine calculation preview',
      },
    },
    additionalProperties: false,
  },
};

const getHandoverSchema = {
  params: {
    type: 'object',
    required: ['bookingId', 'handoverId'],
    properties: {
      bookingId: { type: 'string', minLength: 3 },
      handoverId: { type: 'string', minLength: 3 },
    },
    additionalProperties: false,
  },
};

const getReturnSchema = {
  params: {
    type: 'object',
    required: ['bookingId', 'returnId'],
    properties: {
      bookingId: { type: 'string', minLength: 3 },
      returnId: { type: 'string', minLength: 3 },
    },
    additionalProperties: false,
  },
};

const listHandoversSchema = {
  query: {
    type: 'object',
    properties: {
      bookingId: { type: 'string' },
      status: { type: 'string', enum: ['IN_RENTAL', 'COMPLETED'] },
      limit: { type: 'integer', minimum: 1, maximum: 50 },
      cursor: { type: 'string' },
    },
    additionalProperties: false,
  },
};

const listEventsSchema = {
  params: {
    type: 'object',
    required: ['bookingId'],
    properties: {
      bookingId: { type: 'string', minLength: 3 },
    },
    additionalProperties: false,
  },
  query: {
    type: 'object',
    properties: {
      limit: { type: 'integer', minimum: 1, maximum: 50 },
      cursor: { type: 'string' },
    },
    additionalProperties: false,
  },
};

module.exports = {
  generatePinSchema,
  verifyPinSchema,
  lateFineSchema,
  getHandoverSchema,
  getReturnSchema,
  listHandoversSchema,
  listEventsSchema,
};
