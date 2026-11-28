const crypto = require('crypto');

/**
 * Generates a cryptographically secure 6-digit random PIN.
 * @returns {string} 6-digit string
 */
function generatePin() {
  const pinNum = crypto.randomInt(100000, 1000000);
  return pinNum.toString();
}

/**
 * Hashes a PIN using HMAC-SHA256 with server pepper.
 * @param {string} pin 6-digit PIN
 * @returns {string} Hex-encoded hash
 */
function hashPin(pin) {
  const pepper = process.env.PIN_PEPPER || 'agrirent_pin_pepper_2026_dev';
  return crypto.createHmac('sha256', pepper).update(String(pin).trim()).digest('hex');
}

/**
 * Performs constant-time timing-safe comparison of a candidate PIN against a stored hash.
 * @param {string} candidatePin Plaintext candidate PIN
 * @param {string} storedHash Hex-encoded hash from database
 * @returns {boolean} True if matching, false otherwise
 */
function verifyPin(candidatePin, storedHash) {
  if (!candidatePin || !storedHash) return false;
  const candidateHash = hashPin(candidatePin);
  const bufA = Buffer.from(candidateHash, 'hex');
  const bufB = Buffer.from(storedHash, 'hex');

  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
  generatePin,
  hashPin,
  verifyPin,
};
