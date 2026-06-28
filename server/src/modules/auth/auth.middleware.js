import asyncHandler from '../../middleware/asyncHandler.js';
import ApiError from '../../utils/ApiError.js';
import authService from './auth.service.js';
import authRepository from './auth.repository.js';

const authError = {
  badRequest: (message) => new ApiError(400, message),
  unauthorized: (message) => new ApiError(401, message),
  forbidden: (message) => new ApiError(403, message),
  notFound: (message) => new ApiError(404, message),
};

export const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    throw authError.unauthorized('You are not logged in. Please log in to get access.');
  }

  let decoded;
  try {
    decoded = authService.verifyAccessToken(token);
  } catch (error) {
    throw authError.unauthorized(error.message);
  }

  const user = await authRepository.findById(decoded.userId);
  if (!user) {
    throw authError.unauthorized('User no longer exists.');
  }

  if (!user.isActive) {
    throw authError.unauthorized('Account is deactivated.');
  }

  if (user.changedPasswordAfter(decoded.iat)) {
    throw authError.unauthorized('Password recently changed. Please log in again.');
  }

  req.user = {
    userId: decoded.userId,
    role: decoded.role,
    iat: decoded.iat,
  };

  next();
});

export const optionalAuth = asyncHandler(async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return next();
    }

    const decoded = authService.verifyAccessToken(token);

    const user = await authRepository.findById(decoded.userId);
    if (!user || !user.isActive) {
      return next();
    }

    if (user.changedPasswordAfter(decoded.iat)) {
      return next();
    }

    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      iat: decoded.iat,
    };

    next();
  } catch (error) {
    next();
  }
});

export const authorize = (...allowedRoles) =>
  asyncHandler((req, res, next) => {
    if (!req.user) {
      throw authError.unauthorized('You are not logged in.');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw authError.forbidden('You do not have permission to perform this action.');
    }

    next();
  });

export const verifyEmailRequired = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    throw authError.unauthorized('You are not logged in.');
  }

  const user = await authRepository.findById(req.user.userId);
  if (!user) {
    throw authError.unauthorized('User not found.');
  }

  if (!user.isVerified) {
    throw authError.forbidden('Please verify your email to access this resource.');
  }

  next();
});

export const accountOwnerOnly = asyncHandler((req, res, next) => {
  if (!req.user) {
    throw authError.unauthorized('You are not logged in.');
  }

  const userId = req.params.userId || req.body.userId;

  if (req.user.userId !== userId && req.user.role !== 'admin') {
    throw authError.forbidden('You can only access your own account.');
  }

  next();
});

export const guestOnly = asyncHandler((req, res, next) => {
  if (req.user) {
    throw authError.badRequest('You are already logged in.');
  }

  next();
});

export const validateUserExists = asyncHandler(async (req, res, next) => {
  const userId = req.params.userId || req.user?.userId;

  if (!userId) {
    throw authError.badRequest('User ID is required.');
  }

  const user = await authRepository.findById(userId);
  if (!user) {
    throw authError.notFound('User not found.');
  }

  req.targetUser = user;
  next();
});

export const validateTokenRefresh = asyncHandler(async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!refreshToken) {
    throw authError.unauthorized('Refresh token is required.');
  }

  let decoded;
  try {
    decoded = authService.verifyRefreshToken(refreshToken);
  } catch (error) {
    throw authError.unauthorized(error.message);
  }

  const user = await authRepository.findByRefreshToken(refreshToken);
  if (!user) {
    throw authError.unauthorized('Invalid refresh token.');
  }

  if (!user.isActive) {
    throw authError.unauthorized('Account is deactivated.');
  }

  req.user = {
    userId: decoded.userId,
  };

  next();
});

export const requireAdmin = asyncHandler((req, res, next) => {
  if (!req.user) {
    throw authError.unauthorized('You are not logged in.');
  }

  if (req.user.role !== 'admin') {
    throw authError.forbidden('Admin access required.');
  }

  next();
});

export const requireModerator = asyncHandler((req, res, next) => {
  if (!req.user) {
    throw authError.unauthorized('You are not logged in.');
  }

  if (!['admin', 'moderator'].includes(req.user.role)) {
    throw authError.forbidden('Moderator access required.');
  }

  next();
});
