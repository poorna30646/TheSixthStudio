// src/constants/roles.js
const ROLES = Object.freeze({
  USER: 'user',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
});

const ROLE_VALUES = Object.values(ROLES);

export { ROLES, ROLE_VALUES };