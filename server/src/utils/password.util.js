// src/utils/password.util.js
import bcryptjs from 'bcryptjs';
import { PASSWORD_REGEX } from '../constants/regex.js';

const SALT_ROUNDS = 12;

/**
 * Hash a plain text password using bcryptjs.
 * @param {string} password - The plain text password
 * @returns {Promise<string>} The hashed password
 */
export async function hashPassword(password) {
  const salt = await bcryptjs.genSalt(SALT_ROUNDS);
  return bcryptjs.hash(password, salt);
}

/**
 * Compare a plain text password with a hashed password.
 * @param {string} candidate - The plain text password to check
 * @param {string} hash - The hashed password from the database
 * @returns {Promise<boolean>} True if the password matches
 */
export async function comparePassword(candidate, hash) {
  return bcryptjs.compare(candidate, hash);
}

/**
 * Validate password strength based on regex and length.
 * @param {string} password - The plain text password to validate
 * @returns {{ isValid: boolean, errors: string[] }} Validation result
 */
export function validatePasswordStrength(password) {
  const errors = [];

  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  } else {
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (!/[@$!%*?&]/.test(password)) {
      errors.push('Password must contain at least one special character (@$!%*?&)');
    }
  }

  const isValid = PASSWORD_REGEX.test(password);

  return { isValid, errors };
}