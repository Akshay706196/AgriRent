/**
 * Currency and minor unit conversion utilities.
 * AgriRent Payment Service stores all monetary values internally as integer minor units (paise: 1 INR = 100 paise)
 * to avoid IEEE 754 floating point inaccuracies.
 * All external APIs accept and return decimal amounts in currency "INR".
 */

/**
 * Converts INR (Rupees) decimal or string to integer paise.
 * @param {number|string} rupees
 * @returns {number} integer paise
 */
function toPaise(rupees) {
  if (rupees === undefined || rupees === null) return 0;
  const num = typeof rupees === 'string' ? parseFloat(rupees) : rupees;
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

/**
 * Converts integer paise to INR (Rupees) decimal.
 * @param {number} paise
 * @returns {number} decimal rupees
 */
function toRupees(paise) {
  if (paise === undefined || paise === null) return 0;
  const num = typeof paise === 'string' ? parseInt(paise, 10) : paise;
  if (isNaN(num)) return 0;
  return Math.round(num) / 100;
}

/**
 * Validates that an amount is a valid positive number.
 * @param {number|string} amount
 * @returns {boolean}
 */
function isValidAmount(amount) {
  if (amount === undefined || amount === null) return false;
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return typeof num === 'number' && !isNaN(num) && isFinite(num) && num >= 0;
}

module.exports = {
  toPaise,
  toRupees,
  isValidAmount,
};
