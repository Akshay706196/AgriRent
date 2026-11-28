class AppError extends Error {
  /**
   * @param {number} statusCode HTTP status code
   * @param {string} code Machine-readable error code
   * @param {string} message Human-readable error message
   * @param {Array} details Optional array of specific field errors
   */
  constructor(statusCode, code, message, details = []) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
