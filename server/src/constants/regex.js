// src/constants/regex.js
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const USERNAME_REGEX = /^[a-z0-9_-]{3,30}$/;

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,128}$/;

const MONGO_ID_REGEX = /^[0-9a-fA-F]{24}$/;

const URL_REGEX = /^https?:\/\/.+/;

export { EMAIL_REGEX, USERNAME_REGEX, PASSWORD_REGEX, MONGO_ID_REGEX, URL_REGEX };
