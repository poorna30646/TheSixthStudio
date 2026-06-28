// src/config/cookies.js
const REFRESH_TOKEN_COOKIE = 'refreshToken';

const isProduction = process.env.NODE_ENV === 'production';

const refreshTokenCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Sets the refresh token in an HTTP-only secure cookie.
 * @param {import('express').Response} res - Express response object
 * @param {string} token - The refresh token to store
 */
export function setRefreshTokenCookie(res, token) {
  res.cookie(REFRESH_TOKEN_COOKIE, token, refreshTokenCookieOptions);
}

/**
 * Clears authentication cookies (refresh token).
 * @param {import('express').Response} res - Express response object
 */
export function clearAuthCookies(res) {
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
  });
}

export { REFRESH_TOKEN_COOKIE, refreshTokenCookieOptions };