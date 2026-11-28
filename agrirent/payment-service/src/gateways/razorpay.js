const crypto = require('crypto');
const AppError = require('../utils/AppError');

class RazorpayGateway {
  constructor() {
    this.name = 'razorpay';
    this.keyId = process.env.RAZORPAY_KEY_ID;
    this.keySecret = process.env.RAZORPAY_KEY_SECRET;
  }

  async createOrder({ amount, currency = 'INR', receipt, notes = {} }) {
    if (!this.keyId || !this.keySecret) {
      throw new AppError(500, 'GATEWAY_CONFIG_ERROR', 'Razorpay credentials are not configured in environment.');
    }
    const orderId = `order_rzp_${crypto.randomBytes(6).toString('hex')}`;
    return {
      id: orderId,
      orderId,
      amount,
      currency,
      receipt,
      status: 'created',
    };
  }

  verifySignature({ orderId, paymentId, signature }) {
    if (!signature || !this.keySecret) return false;
    const expected = crypto
      .createHmac('sha256', this.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expected, 'utf8'));
    } catch {
      return false;
    }
  }

  async processRefund({ paymentId, amount, notes = {} }) {
    const refundId = `rfnd_rzp_${crypto.randomBytes(6).toString('hex')}`;
    return {
      id: refundId,
      refundId,
      amount,
      currency: 'INR',
      status: 'processed',
    };
  }
}

module.exports = new RazorpayGateway();
