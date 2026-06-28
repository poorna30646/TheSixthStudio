// src/utils/sanitize.util.js
/**
 * Sanitize a string: trim whitespace.
 * @param {string} value
 * @returns {string} Trimmed string, or empty string if not a string.
 */
export function sanitizeString(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

/**
 * Sanitize an email: trim and convert to lowercase.
 * @param {string} email
 * @returns {string}
 */
export function sanitizeEmail(email) {
  return sanitizeString(email).toLowerCase();
}

/**
 * Sanitize a username: trim and convert to lowercase.
 * @param {string} username
 * @returns {string}
 */
export function sanitizeUsername(username) {
  return sanitizeString(username).toLowerCase();
}

/**
 * Sanitize a MongoDB ObjectId string: trim and validate format.
 * @param {string} id
 * @returns {string|null} The sanitized id or null if invalid.
 */
export function sanitizeMongoId(id) {
  if (typeof id !== 'string') return null;
  const trimmed = id.trim();
  // Basic check for 24 hex chars; more robust check can use MONGO_ID_REGEX.
  if (/^[0-9a-fA-F]{24}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Sanitize a URL: trim and validate.
 * @param {string} url
 * @returns {string|null} The sanitized URL or null if empty/invalid.
 */
export function sanitizeURL(url) {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (trimmed.length === 0) return null;
  // Allow any non-empty trimmed string that looks like a URL or path; actual validation can be done elsewhere.
  return trimmed;
}

/**
 * Sanitize an object by picking only allowed fields and applying per-field sanitizers.
 * @param {Object} input - The raw input object.
 * @param {string[]} allowedFields - Array of field names to keep.
 * @param {Object} [sanitizers] - Optional map of field-specific sanitizer functions.
 * @returns {Object} A new object containing only allowed fields with sanitized values.
 */
export function sanitizeObject(input, allowedFields, sanitizers = {}) {
  if (!input || typeof input !== 'object') return {};

  const result = {};

  for (const field of allowedFields) {
    if (input[field] === undefined) continue;

    let value = input[field];

    // Apply field-specific sanitizer if provided
    if (typeof sanitizers[field] === 'function') {
      value = sanitizers[field](value);
    } else if (typeof value === 'string') {
      // Default string sanitization: trim
      value = value.trim();
    }

    result[field] = value;
  }

  return result;
}

/**
 * Common sanitization presets for user-related fields.
 */
export const UserSanitizers = {
  email: (val) => sanitizeEmail(val),
  username: (val) => sanitizeUsername(val),
  fullName: (val) => sanitizeString(val),
  avatar: (val) => sanitizeURL(val),
  plan: (val) => sanitizeString(val).toLowerCase(),
  role: (val) => sanitizeString(val).toLowerCase(),
};