// src/utils/validators.js
import { EMAIL_REGEX, USERNAME_REGEX, MONGO_ID_REGEX, URL_REGEX } from '../constants/regex.js';
import { ROLE_VALUES } from '../constants/roles.js';
import { PLAN_VALUES } from '../constants/plans.js';

/**
 * Check if a string is a valid email format.
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_REGEX.test(email);
}

/**
 * Check if a string is a valid username.
 * @param {string} username
 * @returns {boolean}
 */
export function isValidUsername(username) {
  return typeof username === 'string' && USERNAME_REGEX.test(username);
}

/**
 * Check if a string is a valid MongoDB ObjectId.
 * @param {string} id
 * @returns {boolean}
 */
export function isValidMongoId(id) {
  return typeof id === 'string' && MONGO_ID_REGEX.test(id);
}

/**
 * Check if a string is a valid URL.
 * @param {string} url
 * @returns {boolean}
 */
export function isValidURL(url) {
  return typeof url === 'string' && URL_REGEX.test(url);
}

/**
 * Check if a string is a valid role.
 * @param {string} role
 * @returns {boolean}
 */
export function isValidRole(role) {
  return ROLE_VALUES.includes(role);
}

/**
 * Check if a string is a valid plan.
 * @param {string} plan
 * @returns {boolean}
 */
export function isValidPlan(plan) {
  return PLAN_VALUES.includes(plan);
}

/**
 * Check if a token is a non-empty string.
 * @param {string} token
 * @returns {boolean}
 */
export function isValidToken(token) {
  return typeof token === 'string' && token.trim().length > 0;
}