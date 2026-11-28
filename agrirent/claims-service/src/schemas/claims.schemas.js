/**
 * Ajv JSON Schemas for AgriRent Claims, Disputes & Reviews Service.
 */

const EVIDENCE_MAX_PHOTOS = parseInt(process.env.EVIDENCE_MAX_PHOTOS, 10) || 10;

const submitClaimSchema = {
  params: {
    type: 'object',
    required: ['bookingId'],
    properties: {
      bookingId: { type: 'string', minLength: 3, maxLength: 64 },
    },
    additionalProperties: false,
  },
  body: {
    type: 'object',
    required: ['reason', 'claimedAmount', 'evidence'],
    properties: {
      reason: { type: 'string', minLength: 3, maxLength: 1000 },
      claimedAmount: { type: 'number', exclusiveMinimum: 0 },
      evidence: {
        type: 'object',
        required: ['photos'],
        properties: {
          photos: {
            type: 'array',
            items: { type: 'string', minLength: 1 },
            minItems: 1,
            maxItems: EVIDENCE_MAX_PHOTOS,
          },
          notes: { type: 'string', maxLength: 2000 },
        },
        additionalProperties: false,
      },
      claimantId: { type: 'string' },
    },
    additionalProperties: false,
  },
};

const addEvidenceSchema = {
  params: {
    type: 'object',
    required: ['claimId'],
    properties: {
      claimId: { type: 'string', minLength: 3, maxLength: 64 },
    },
    additionalProperties: false,
  },
  body: {
    type: 'object',
    properties: {
      photos: {
        type: 'array',
        items: { type: 'string', minLength: 1 },
        maxItems: EVIDENCE_MAX_PHOTOS,
      },
      notes: { type: 'string', maxLength: 2000 },
    },
    additionalProperties: false,
  },
};

const raiseDisputeSchema = {
  params: {
    type: 'object',
    required: ['claimId'],
    properties: {
      claimId: { type: 'string', minLength: 3, maxLength: 64 },
    },
    additionalProperties: false,
  },
  body: {
    type: 'object',
    required: ['reason'],
    properties: {
      reason: { type: 'string', minLength: 3, maxLength: 1000 },
      evidence: {
        type: 'object',
        properties: {
          photos: {
            type: 'array',
            items: { type: 'string' },
            maxItems: EVIDENCE_MAX_PHOTOS,
          },
          notes: { type: 'string', maxLength: 2000 },
        },
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  },
};

const reviewClaimDecisionSchema = {
  params: {
    type: 'object',
    required: ['claimId'],
    properties: {
      claimId: { type: 'string', minLength: 3, maxLength: 64 },
    },
    additionalProperties: false,
  },
  body: {
    type: 'object',
    required: ['decision', 'reason'],
    properties: {
      decision: {
        type: 'string',
        enum: ['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'],
      },
      approvedAmount: { type: 'number', minimum: 0 },
      reason: { type: 'string', minLength: 3, maxLength: 1000 },
    },
    additionalProperties: false,
  },
};

const submitReviewSchema = {
  params: {
    type: 'object',
    required: ['bookingId'],
    properties: {
      bookingId: { type: 'string', minLength: 3, maxLength: 64 },
    },
    additionalProperties: false,
  },
  body: {
    type: 'object',
    required: ['targetUserId', 'rating', 'feedback'],
    properties: {
      targetUserId: { type: 'string', minLength: 3, maxLength: 64 },
      rating: { type: 'integer', minimum: 1, maximum: 5 },
      feedback: { type: 'string', minLength: 3, maxLength: 2000 },
    },
    additionalProperties: false,
  },
};

const listClaimsSchema = {
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

const listDisputesSchema = {
  query: {
    type: 'object',
    properties: {
      claimId: { type: 'string' },
      status: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 50 },
      cursor: { type: 'string' },
    },
    additionalProperties: true,
  },
};

const listReviewsSchema = {
  query: {
    type: 'object',
    properties: {
      targetUserId: { type: 'string' },
      bookingId: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 50 },
      cursor: { type: 'string' },
    },
    additionalProperties: true,
  },
};

const bookingIdParamSchema = {
  params: {
    type: 'object',
    required: ['bookingId'],
    properties: {
      bookingId: { type: 'string', minLength: 3, maxLength: 64 },
    },
    additionalProperties: false,
  },
};

const claimIdParamSchema = {
  params: {
    type: 'object',
    required: ['claimId'],
    properties: {
      claimId: { type: 'string', minLength: 3, maxLength: 64 },
    },
    additionalProperties: false,
  },
};

const disputeIdParamSchema = {
  params: {
    type: 'object',
    required: ['disputeId'],
    properties: {
      disputeId: { type: 'string', minLength: 3, maxLength: 64 },
    },
    additionalProperties: false,
  },
};

const reviewIdParamSchema = {
  params: {
    type: 'object',
    required: ['reviewId'],
    properties: {
      reviewId: { type: 'string', minLength: 3, maxLength: 64 },
    },
    additionalProperties: false,
  },
};

const userIdParamSchema = {
  params: {
    type: 'object',
    required: ['userId'],
    properties: {
      userId: { type: 'string', minLength: 3, maxLength: 64 },
    },
    additionalProperties: false,
  },
};

module.exports = {
  submitClaimSchema,
  addEvidenceSchema,
  raiseDisputeSchema,
  reviewClaimDecisionSchema,
  submitReviewSchema,
  listClaimsSchema,
  listDisputesSchema,
  listReviewsSchema,
  bookingIdParamSchema,
  claimIdParamSchema,
  disputeIdParamSchema,
  reviewIdParamSchema,
  userIdParamSchema,
};
