/**
 * Ajv JSON Schemas for all Payment Service Operations.
 */

const initiatePaymentSchema = {
  body: {
    type: 'object',
    required: ['bookingId'],
    properties: {
      bookingId: { type: 'string', minLength: 1 },
      renterId: { type: 'string' },
      rentalAmount: { type: 'number', minimum: 0 },
      deposit: { type: 'number', minimum: 0 },
      currency: { type: 'string', default: 'INR' },
    },
    additionalProperties: true,
  },
};

const verifyPaymentSchema = {
  params: {
    type: 'object',
    required: ['paymentId'],
    properties: {
      paymentId: { type: 'string', minLength: 1 },
    },
  },
  body: {
    type: 'object',
    properties: {
      gatewayTransactionReference: { type: 'string' },
      transactionReference: { type: 'string' },
      gatewayOrderId: { type: 'string' },
      signature: { type: 'string' },
    },
    additionalProperties: true,
  },
};

const holdDepositSchema = {
  params: {
    type: 'object',
    required: ['bookingId'],
    properties: {
      bookingId: { type: 'string', minLength: 1 },
    },
  },
  body: {
    type: 'object',
    properties: {
      depositAmount: { type: 'number', minimum: 0 },
      paymentReference: { type: 'string' },
    },
    additionalProperties: true,
  },
};

const refundPaymentSchema = {
  params: {
    type: 'object',
    required: ['paymentId'],
    properties: {
      paymentId: { type: 'string', minLength: 1 },
    },
  },
  body: {
    type: 'object',
    required: ['amount'],
    properties: {
      amount: { type: 'number', exclusiveMinimum: 0 },
      reason: { type: 'string', maxLength: 500 },
    },
    additionalProperties: true,
  },
};

const settlePaymentSchema = {
  params: {
    type: 'object',
    required: ['bookingId'],
    properties: {
      bookingId: { type: 'string', minLength: 1 },
    },
  },
  body: {
    type: 'object',
    properties: {
      rentalAmount: { type: 'number', minimum: 0 },
      lateFine: { type: 'number', minimum: 0 },
      damageDeduction: { type: 'number', minimum: 0 },
      disputedAmount: { type: 'number', minimum: 0 },
      depositBalance: { type: 'number' },
    },
    additionalProperties: true,
  },
};

const listPaymentsSchema = {
  query: {
    type: 'object',
    properties: {
      bookingId: { type: 'string' },
      status: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 50 },
      cursor: { type: 'string' },
    },
    additionalProperties: true,
  },
};

const getEventsSchema = {
  params: {
    type: 'object',
    required: ['paymentId'],
    properties: {
      paymentId: { type: 'string', minLength: 1 },
    },
  },
  query: {
    type: 'object',
    properties: {
      limit: { type: 'integer', minimum: 1, maximum: 50 },
      cursor: { type: 'string' },
    },
    additionalProperties: true,
  },
};

module.exports = {
  initiatePaymentSchema,
  verifyPaymentSchema,
  holdDepositSchema,
  refundPaymentSchema,
  settlePaymentSchema,
  listPaymentsSchema,
  getEventsSchema,
};
