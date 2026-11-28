const AppError = require('./AppError');
const logger = require('./logger');

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD, 10) || 3;
    this.resetTimeoutMs = options.resetTimeoutMs || parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT_MS, 10) || 10000;
    this.errorType = options.errorType || 'UPSTREAM_UNAVAILABLE';

    this.state = 'CLOSED'; // 'CLOSED' | 'OPEN' | 'HALF_OPEN'
    this.failureCount = 0;
    this.nextAttempt = Date.now();
  }

  async execute(action) {
    const now = Date.now();

    if (this.state === 'OPEN') {
      if (now > this.nextAttempt) {
        this.state = 'HALF_OPEN';
        logger.info(`[CircuitBreaker:${this.name}] Transitioning to HALF_OPEN probe.`);
      } else {
        logger.warn(`[CircuitBreaker:${this.name}] Fast-failing request (Circuit is OPEN).`);
        throw new AppError(
          503,
          this.errorType,
          `Service '${this.name}' is currently unavailable. Circuit breaker is OPEN.`
        );
      }
    }

    try {
      const result = await action();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure(err);
      throw err;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      logger.info(`[CircuitBreaker:${this.name}] Probe successful. Resetting state to CLOSED.`);
    }
    this.state = 'CLOSED';
  }

  onFailure(err) {
    // Only count 5xx or network/timeout errors towards circuit breaker trips
    const statusCode = err.statusCode || err.response?.status;
    const isServerOrNetworkError = !statusCode || statusCode >= 500;

    if (isServerOrNetworkError) {
      this.failureCount += 1;
      logger.warn(`[CircuitBreaker:${this.name}] Recorded failure ${this.failureCount}/${this.failureThreshold}: ${err.message}`);

      if (this.failureCount >= this.failureThreshold || this.state === 'HALF_OPEN') {
        this.state = 'OPEN';
        this.nextAttempt = Date.now() + this.resetTimeoutMs;
        logger.error(`[CircuitBreaker:${this.name}] Threshold reached. Circuit breaker tripped to OPEN until ${new Date(this.nextAttempt).toISOString()}`);
      }
    }
  }

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.nextAttempt = Date.now();
  }
}

module.exports = CircuitBreaker;
