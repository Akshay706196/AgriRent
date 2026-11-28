/**
 * Currency conversion utilities for AgriRent microservices.
 * AgriRent stores all monetary amounts internally in integer minor units (paise for INR).
 * 1 INR = 100 Paise.
 */

/**
 * Converts major currency units (Rupees) to minor integer units (Paise).
 * @param {number|string} rupees
 * @returns {number} Integer paise
 */
function toPaise(rupees) {
  const parsed = typeof rupees === 'string' ? parseFloat(rupees) : rupees;
  if (isNaN(parsed)) {
    throw new Error(`Invalid monetary amount: ${rupees}`);
  }
  return Math.round(parsed * 100);
}

/**
 * Converts minor currency units (Paise) to major currency units (Rupees).
 * @param {number} paise
 * @returns {number} Decimal Rupees formatted to 2 places
 */
function toRupees(paise) {
  const parsed = parseInt(paise, 10);
  if (isNaN(parsed)) {
    return 0.0;
  }
  return parseFloat((parsed / 100).toFixed(2));
}

module.exports = {
  toPaise,
  toRupees,
};
