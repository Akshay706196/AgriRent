const logger = require('../utils/logger');

class NotificationClient {
  /**
   * Dispatches claim/dispute/decision notifications to relevant participants.
   * Never includes sensitive evidence text.
   * @param {Object} params
   * @param {string} params.recipientId Recipient user identifier
   * @param {string} params.bookingId Booking identifier
   * @param {string} params.claimId Claim identifier
   * @param {string} params.type Notification event type
   * @param {string} params.message Non-sensitive notification summary
   * @param {string} params.correlationId Request correlation identifier
   */
  async sendNotification({ recipientId, bookingId, claimId, type, message, correlationId = 'internal' }) {
    logger.info(`[Notification] ${type} sent to user ${recipientId} for booking ${bookingId} (claim: ${claimId || 'N/A'})`, {
      recipientId,
      bookingId,
      claimId,
      type,
      channel: 'NOTIFICATION_STUB',
      correlationId,
    });

    return {
      success: true,
      deliveryStatus: 'DELIVERED',
      deliveredAt: new Date().toISOString(),
    };
  }
}

module.exports = new NotificationClient();
