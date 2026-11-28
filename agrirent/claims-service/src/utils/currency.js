/**
 * Monetary conversion utility for AgriRent.
 * All monetary amounts in SQL storage and calculation are strict integer paise.
 * 1 INR = 100 paise.
 */

function toPaise(rupees) {
  if (rupees === null || rupees === undefined || isNaN(rupees)) {
    return 0;
  }
  return Math.round(Number(rupees) * 100);
}

function toRupees(paise) {
  if (paise === null || paise === undefined || isNaN(paise)) {
    return 0;
  }
  return Number((Number(paise) / 100).toFixed(2));
}

function isValidAmount(amount) {
  return typeof amount === 'number' && !isNaN(amount) && amount >= 0;
}

module.exports = {
  toPaise,
  toRupees,
  isValidAmount,
};
