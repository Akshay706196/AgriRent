const AppError = require('./AppError');

let programmaticOverride = null;

class Clock {
  /**
   * Returns current Date, honoring programmatic injection or TIME_OVERRIDE_ISO env in non-production.
   * Throws if override is attempted in production.
   * @returns {Date}
   */
  now() {
    if (process.env.NODE_ENV === 'production') {
      if (process.env.TIME_OVERRIDE_ISO || programmaticOverride) {
        throw new Error('SECURITY VIOLATION: Clock time override is strictly forbidden in production mode.');
      }
      return new Date();
    }

    if (programmaticOverride) {
      return new Date(programmaticOverride);
    }

    if (process.env.TIME_OVERRIDE_ISO) {
      const parsed = new Date(process.env.TIME_OVERRIDE_ISO);
      if (isNaN(parsed.getTime())) {
        throw new AppError(400, 'INVALID_TIME_OVERRIDE', `Invalid TIME_OVERRIDE_ISO: ${process.env.TIME_OVERRIDE_ISO}`);
      }
      return parsed;
    }

    return new Date();
  }

  /**
   * Returns current ISO string.
   */
  toISOString() {
    return this.now().toISOString();
  }

  /**
   * Programmatically set an override for testing purposes.
   * Strictly disabled in production.
   */
  setOverride(dateOrIso) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SECURITY VIOLATION: Clock override is strictly forbidden in production mode.');
    }
    programmaticOverride = dateOrIso ? new Date(dateOrIso) : null;
  }

  /**
   * Clears any active programmatic override.
   */
  reset() {
    programmaticOverride = null;
  }
}

module.exports = new Clock();
