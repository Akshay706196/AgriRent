const simulator = require('./simulator');
const razorpay = require('./razorpay');
const CircuitBreaker = require('../utils/circuitBreaker');

const gatewayBreaker = new CircuitBreaker('PaymentGateway', {
  errorType: 'GATEWAY_UNAVAILABLE',
});

function getRawGateway() {
  const selected = (process.env.PAYMENT_GATEWAY || 'simulator').toLowerCase();
  if (selected === 'razorpay') {
    return razorpay;
  }
  return simulator;
}

const gatewayClient = {
  get name() {
    return getRawGateway().name;
  },

  createOrder(params) {
    return gatewayBreaker.execute(() => getRawGateway().createOrder(params));
  },

  verifySignature(params, secret) {
    return getRawGateway().verifySignature(params, secret);
  },

  processRefund(params) {
    return gatewayBreaker.execute(() => getRawGateway().processRefund(params));
  },

  generateSignature(params, secret) {
    if (getRawGateway().generateSignature) {
      return getRawGateway().generateSignature(params, secret);
    }
    return simulator.generateSignature(params, secret);
  },

  breaker: gatewayBreaker,
};

module.exports = gatewayClient;
