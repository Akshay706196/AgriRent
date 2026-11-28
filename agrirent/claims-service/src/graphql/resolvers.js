const { GraphQLError } = require('graphql');
const claimService = require('../services/claim.service');
const disputeService = require('../services/dispute.service');
const reviewService = require('../services/review.service');
const settlementSagaService = require('../services/settlementSaga.service');
const { getSqlDb } = require('../config/database');
const { toRupees } = require('../utils/currency');

function toGraphQLError(err, correlationId) {
  const code = err.statusCode === 403 ? 'FORBIDDEN' : err.code || 'INTERNAL_ERROR';
  return new GraphQLError(err.message, {
    extensions: {
      code,
      correlationId: correlationId || 'unknown',
    },
  });
}

const resolvers = {
  Query: {
    claim: async (_, { id }, context) => {
      try {
        return await claimService.getClaim(id, context.user, context.correlationId);
      } catch (err) {
        throw toGraphQLError(err, context.correlationId);
      }
    },

    claims: async (_, { bookingId, status, first = 10, after }, context) => {
      try {
        const limit = Math.min(Math.max(1, first), 50);
        const result = await claimService.listClaims({
          bookingId,
          status,
          limit,
          cursor: after,
          user: context.user,
        });

        return {
          edges: result.items.map((item) => ({
            cursor: Buffer.from(`${item.createdAt}_${item.claimId}`).toString('base64'),
            node: item,
          })),
          pageInfo: {
            hasNextPage: result.hasMore,
            endCursor: result.nextCursor,
          },
          totalCount: result.items.length,
        };
      } catch (err) {
        throw toGraphQLError(err, context.correlationId);
      }
    },

    dispute: async (_, { id }, context) => {
      try {
        return await disputeService.getDispute(id, context.user, context.correlationId);
      } catch (err) {
        throw toGraphQLError(err, context.correlationId);
      }
    },

    disputes: async (_, { claimId, status, first = 10, after }, context) => {
      try {
        const limit = Math.min(Math.max(1, first), 50);
        const result = await disputeService.listDisputes({
          claimId,
          status,
          limit,
          cursor: after,
          user: context.user,
        });

        return {
          edges: result.items.map((item) => ({
            cursor: Buffer.from(`${item.createdAt}_${item.disputeId}`).toString('base64'),
            node: item,
          })),
          pageInfo: {
            hasNextPage: result.hasMore,
            endCursor: result.nextCursor,
          },
          totalCount: result.items.length,
        };
      } catch (err) {
        throw toGraphQLError(err, context.correlationId);
      }
    },

    reviews: async (_, { targetUserId, bookingId, first = 10, after }, context) => {
      try {
        const limit = Math.min(Math.max(1, first), 50);
        const result = await reviewService.listReviews({
          targetUserId,
          bookingId,
          limit,
          cursor: after,
        });

        return {
          edges: result.items.map((item) => ({
            cursor: Buffer.from(`${item.createdAt}_${item.reviewId}`).toString('base64'),
            node: item,
          })),
          pageInfo: {
            hasNextPage: result.hasMore,
            endCursor: result.nextCursor,
          },
          totalCount: result.items.length,
        };
      } catch (err) {
        throw toGraphQLError(err, context.correlationId);
      }
    },

    reviewSummary: async (_, { userId }, context) => {
      try {
        return await reviewService.getReviewSummary(userId);
      } catch (err) {
        throw toGraphQLError(err, context.correlationId);
      }
    },

    bookingOverview: async (_, { bookingId }, context) => {
      try {
        const [claimsRes, reviewsRes, settlementRes] = await Promise.all([
          claimService.listClaims({ bookingId, limit: 50, user: context.user }),
          reviewService.listReviews({ bookingId, limit: 50 }),
          settlementSagaService.getSettlementStatus(bookingId, context.user, context.correlationId),
        ]);

        return {
          bookingId,
          claims: claimsRes.items,
          reviews: reviewsRes.items,
          settlementStatus: {
            ...settlementRes,
            settlementRequestId: settlementRes.settlementRequest?.requestId || null,
            settlementRequestStatus: settlementRes.settlementRequest?.status || null,
          },
        };
      } catch (err) {
        throw toGraphQLError(err, context.correlationId);
      }
    },
  },

  Claim: {
    evidence: async (claim, _, context) => {
      const docs = await context.loaders.evidenceLoader.load(claim.claimId);
      return docs.map((doc) => ({
        evidenceId: doc.evidenceId,
        photos: doc.photos || [],
        notes: doc.notes,
        addedBy: doc.addedBy,
        createdAt: doc.createdAt?.toISOString ? doc.createdAt.toISOString() : String(doc.createdAt),
      }));
    },

    events: async (claim, _, context) => {
      const events = await context.loaders.eventsLoader.load(claim.claimId);
      return events.map((e) => ({
        eventId: e.eventId,
        eventType: e.eventType,
        actor: e.actor,
        actorRole: e.actorRole,
        payload: e.payload ? JSON.stringify(e.payload) : null,
        timestamp: e.timestamp?.toISOString ? e.timestamp.toISOString() : String(e.timestamp),
      }));
    },

    conditionComparison: async (claim, _, context) => {
      const docs = await context.loaders.evidenceLoader.load(claim.claimId);
      const withSnapshot = docs.find((d) => d.conditionReportSnapshot);
      if (!withSnapshot || !withSnapshot.conditionReportSnapshot) return null;

      const snap = withSnapshot.conditionReportSnapshot;
      return {
        handover: snap.handoverConditionReport || null,
        return: snap.returnConditionReport || null,
        handoverAt: snap.handoverAt?.toISOString ? snap.handoverAt.toISOString() : snap.handoverAt,
        returnedAt: snap.returnedAt?.toISOString ? snap.returnedAt.toISOString() : snap.returnedAt,
      };
    },

    disputes: async (claim) => {
      const db = getSqlDb();
      const rows = db.prepare('SELECT * FROM disputes WHERE claimId = ?').all(claim.claimId);
      return rows.map((d) => ({
        disputeId: d.disputeId,
        claimId: d.claimId,
        bookingId: d.bookingId,
        raisedBy: d.raisedBy,
        reason: d.reason,
        status: d.status,
        decision: d.decision || null,
        decisionReason: d.decisionReason || null,
        resolvedAt: d.resolvedAt || null,
        createdAt: d.createdAt,
      }));
    },
  },
};

module.exports = resolvers;
