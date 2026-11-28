/**
 * Normalizes email address by trimming whitespace and lowercasing.
 */
const normalizeEmail = (email) => {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
};

/**
 * Normalizes phone numbers by trimming and stripping separating spaces or dashes.
 */
const normalizePhone = (phone) => {
  if (!phone || typeof phone !== 'string') return '';
  let cleaned = phone.trim().replace(/[\s\-()]/g, '');
  // If 10 digits without leading country code, prepend standard +91 for Indian agricultural context
  if (/^\d{10}$/.test(cleaned)) {
    cleaned = `+91${cleaned}`;
  }
  return cleaned;
};

module.exports = {
  normalizeEmail,
  normalizePhone,
};
