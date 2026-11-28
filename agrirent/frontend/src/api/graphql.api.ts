import { apiFetch } from './client';
import { API_CONFIG } from './config';
import { BookingOverview } from './types';

const BOOKING_OVERVIEW_QUERY = `
  query GetBookingOverview($bookingId: ID!) {
    bookingOverview(bookingId: $bookingId) {
      bookingId
      settlementStatus {
        bookingId
        caseStatus
        windowClosed
        claimWindowClosesAt
        waivedAt
        depositHeld
        lateFine
        totalDamageDeduction
        claimsCount
        openClaimsCount
        openDisputesCount
        eligibleForSettlement
        settlementRequestId
        settlementRequestStatus
        evaluatedAt
      }
      claims {
        claimId
        bookingId
        claimantId
        reason
        claimedAmount
        status
        windowClosesAt
        createdAt
        evidence {
          evidenceId
          photos
          notes
          addedBy
          createdAt
        }
        disputes {
          disputeId
          claimId
          status
          reason
          decision
          resolvedAt
          createdAt
        }
        decision {
          decisionId
          decision
          approvedAmount
          reason
          decidedBy
          decidedAt
        }
      }
      reviews {
        reviewId
        bookingId
        reviewerId
        targetUserId
        rating
        feedback
        status
        createdAt
      }
    }
  }
`;

export const graphqlApi = {
  async getBookingOverview(bookingId: string): Promise<BookingOverview> {
    const res = await apiFetch<{ data: { bookingOverview: BookingOverview }; errors?: any[] }>(
      API_CONFIG.claims.graphqlUrl,
      {
        method: 'POST',
        body: JSON.stringify({
          query: BOOKING_OVERVIEW_QUERY,
          variables: { bookingId },
        }),
      }
    );

    if (res.errors && res.errors.length > 0) {
      throw new Error(res.errors[0]?.message || 'GraphQL query failed');
    }

    return res.data.bookingOverview;
  },
};
