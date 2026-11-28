const logger = require('../utils/logger');

class NotificationClient {
  /**
   * Dispatches PIN notification to the renter via simulated SMS/Notification channel.
   * NOTE: The PIN is deliberately omitted from structured logs to protect security.
   * @param {Object} params
   * @param {string} params.recipientId Renter user identifier
   * @param {string} params.bookingId Booking identifier
   * @param {string} params.pinType 'HANDOVER' | 'RETURN'
   * @param {string} params.pin Plaintext PIN
   * @param {string} params.correlationId Request correlation identifier
   */
  async sendPinNotification({ recipientId, bookingId, pinType, pin, correlationId }) {
    // Stub implementation: log dispatch event WITHOUT the plaintext PIN
    logger.info(`[Notification] PIN sent to user ${recipientId} for booking ${bookingId} (type: ${pinType})`, {
      recipientId,
      bookingId,
      pinType,
      channel: 'SMS_NOTIFICATION_STUB',
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
