const crypto = require('crypto');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

class GatewaySimulator {
  constructor() {
    this.name = 'simulator';
  }

  /**
   * Helper to introduce simulated delays.
   */
  async _delay(ms) {
    if (ms > 0) {
      await new Promise((resolve) => setTimeout(resolve, ms));
    }
  }

  /**
   * Simulates creating an order in payment gateway sandbox.
   */
  async createOrder({ amount, currency = 'INR', receipt, notes = {} }) {
    // 1. Check for forced 5xx error simulation (e.g. for circuit breaker test)
    if (process.env.GATEWAY_SIMULATOR_FORCE_5XX === 'true' || notes.force5xx === true) {
      throw new AppError(502, 'GATEWAY_ERROR', 'Simulated gateway 502 Bad Gateway failure.');
    }

    // 2. Check for simulated latency
    const slowMs = notes.slowMs || parseInt(process.env.GATEWAY_SIMULATOR_SLOW_MS, 10) || 0;
    await this._delay(slowMs);

    // 3. Check for forced failure trigger
    if (receipt === 'FORCE_FAIL' || notes.forceFail === true) {
      throw new AppError(422, 'PAYMENT_FAILED', 'Simulated gateway declined order creation.');
    }

    const orderId = `order_sim_${crypto.randomBytes(6).toString('hex')}`;
    return {
      id: orderId,
      orderId,
      amount, // in paise
      currency,
      receipt,
      status: 'created',
      createdAt: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Generates a valid HMAC-SHA256 signature for test/simulation purposes.
   */
  generateSignature({ orderId, paymentId }, secret) {
    const webhookSecret = secret || process.env.GATEWAY_WEBHOOK_SECRET || 'agrirent_webhook_secret_key_2026_dev';
    const payload = `${orderId}|${paymentId}`;
    return crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
  }

  /**
   * Verifies an incoming HMAC-SHA256 signature.
   */
  verifySignature({ orderId, paymentId, signature }, secret) {
    if (!signature) {
      return false;
    }
    const expected = this.generateSignature({ orderId, paymentId }, secret);
    try {
      return crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expected, 'utf8'));
    } catch {
      return false;
    }
  }

  /**
   * Simulates processing a refund.
   */
  async processRefund({ paymentId, amount, notes = {} }) {
    if (process.env.GATEWAY_SIMULATOR_FORCE_5XX === 'true' || notes.force5xx === true) {
      throw new AppError(502, 'GATEWAY_ERROR', 'Simulated gateway refund failure.');
    }

    const refundId = `rfnd_sim_${crypto.randomBytes(6).toString('hex')}`;
    return {
      id: refundId,
      refundId,
      amount,
      currency: 'INR',
      paymentId,
      status: 'processed',
      createdAt: Math.floor(Date.now() / 1000),
    };
  }
}

module.exports = new GatewaySimulator();
