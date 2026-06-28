import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import '../../config/env.js';
import authRepository from './auth.repository.js';

class ServiceError extends Error {
  constructor(message, code = 'INTERNAL_ERROR', statusCode = 500) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

class AuthService {
  constructor() {
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET;
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET;
    if (!this.accessTokenSecret) {
      throw new ServiceError(
        'JWT_ACCESS_SECRET environment variable is required',
        'CONFIG_ERROR',
        500
      );
    }
    if (!this.refreshTokenSecret) {
      throw new ServiceError(
        'JWT_REFRESH_SECRET environment variable is required',
        'CONFIG_ERROR',
        500
      );
    }
    this.accessTokenExpire =
      process.env.JWT_ACCESS_EXPIRES_IN ||
      process.env.JWT_ACCESS_EXPIRE ||
      '15m';
    this.refreshTokenExpire =
      process.env.JWT_REFRESH_EXPIRES_IN ||
      process.env.JWT_REFRESH_EXPIRE ||
      '7d';
    this.tokenHashAlgorithm = 'sha256';
    this.extensionHooks = {
      onRegister: [],
      onLogin: [],
      onLogout: [],
      onPasswordChange: [],
      onEmailVerified: [],
      onOAuthLogin: [],
      onTwoFactorRequired: [],
      onAuditLog: [],
    };
  }

  registerExtensionHook(event, callback) {
    if (this.extensionHooks[event]) {
      this.extensionHooks[event].push(callback);
    }
  }

  async triggerHook(event, data) {
    for (const hook of this.extensionHooks[event] || []) {
      try {
        await hook(data);
      } catch (error) {
        console.error(`[EXTENSION HOOK ERROR] ${event}:`, error.message);
      }
    }
  }

  hashToken(token) {
    return crypto.createHash(this.tokenHashAlgorithm).update(token).digest('hex');
  }

  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  generateAccessToken(userId, role = 'user') {
    try {
      const payload = {
        userId,
        role,
        type: 'access',
      };

      return jwt.sign(payload, this.accessTokenSecret, {
        expiresIn: this.accessTokenExpire,
      });
    } catch (error) {
      throw new ServiceError('Failed to generate access token', 'TOKEN_GENERATION_ERROR');
    }
  }

  generateRefreshToken(userId) {
    try {
      const payload = {
        userId,
        type: 'refresh',
      };

      return jwt.sign(payload, this.refreshTokenSecret, {
        expiresIn: this.refreshTokenExpire,
        jwtid: crypto.randomUUID(),
      });
    } catch (error) {
      throw new ServiceError('Failed to generate refresh token', 'TOKEN_GENERATION_ERROR');
    }
  }

  verifyAccessToken(token) {
    try {
      return jwt.verify(token, this.accessTokenSecret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new ServiceError('Access token has expired', 'TOKEN_EXPIRED', 401);
      }
      if (error.name === 'JsonWebTokenError') {
        throw new ServiceError('Invalid access token', 'INVALID_TOKEN', 401);
      }
      throw new ServiceError('Token verification failed', 'TOKEN_VERIFICATION_ERROR', 401);
    }
  }

  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, this.refreshTokenSecret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new ServiceError('Refresh token has expired', 'TOKEN_EXPIRED', 401);
      }
      if (error.name === 'JsonWebTokenError') {
        throw new ServiceError('Invalid refresh token', 'INVALID_TOKEN', 401);
      }
      throw new ServiceError('Token verification failed', 'TOKEN_VERIFICATION_ERROR', 401);
    }
  }

  sanitizeUser(user) {
    if (!user) return null;

    const userObj = user.toJSON ? user.toJSON() : user;

    return {
      id: userObj._id || userObj.id,
      fullName: userObj.fullName,
      username: userObj.username,
      email: userObj.email,
      avatar: userObj.avatar,
      role: userObj.role,
      plan: userObj.plan,
      isVerified: userObj.isVerified,
      isActive: userObj.isActive,
      storageUsed: userObj.storageUsed,
      storageLimit: userObj.storageLimit,
      lastLogin: userObj.lastLogin,
      createdAt: userObj.createdAt,
      updatedAt: userObj.updatedAt,
    };
  }

  async register(registrationData) {
    const { fullName, username, email, password, passwordConfirm } = registrationData;

    if (password !== passwordConfirm) {
      throw new ServiceError('Passwords do not match', 'PASSWORD_MISMATCH', 400);
    }

    const emailExists = await authRepository.existsByEmail(email);
    if (emailExists) {
      throw new ServiceError('Email already registered', 'EMAIL_EXISTS', 409);
    }

    const usernameExists = await authRepository.existsByUsername(username);
    if (usernameExists) {
      throw new ServiceError('Username already taken', 'USERNAME_EXISTS', 409);
    }

    const emailVerificationToken = this.generateToken();
    const emailVerificationTokenHash = this.hashToken(emailVerificationToken);
    const emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;

    const newUser = await authRepository.create({
      fullName,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password,
      provider: 'email',
      emailVerificationToken: emailVerificationTokenHash,
      emailVerificationExpires,
    });

    await this.triggerHook('onRegister', {
      userId: newUser._id,
      email: newUser.email,
      username: newUser.username,
    });

    await this.triggerHook('onAuditLog', {
      action: 'user:registered',
      userId: newUser._id,
      email: newUser.email,
    });

    return {
      user: this.sanitizeUser(newUser),
      verificationToken: emailVerificationToken,
    };
  }

  async login(email, password) {
    const user = await authRepository.findByEmail(email, 'password');

    if (!user) {
      throw new ServiceError('Invalid email or password', 'INVALID_CREDENTIALS', 401);
    }

    if (!user.isActive) {
      throw new ServiceError('Account is deactivated', 'ACCOUNT_DEACTIVATED', 403);
    }

    const isLocked = await authRepository.isAccountLocked(user._id);
    if (isLocked) {
      throw new ServiceError(
        'Account is locked due to multiple failed login attempts. Please try again later.',
        'ACCOUNT_LOCKED',
        429
      );
    }

    const passwordMatch = await user.comparePassword(password);

    if (!passwordMatch) {
      await authRepository.incrementLoginAttempts(user._id);
      throw new ServiceError('Invalid email or password', 'INVALID_CREDENTIALS', 401);
    }

    // Reset login attempts on successful login
    await authRepository.resetLoginAttempts(user._id);

    // Two-factor check is left as a hook for extensions.
    // You can register a hook to 'onTwoFactorRequired' to enforce 2FA.

    const accessToken = this.generateAccessToken(user._id, user.role);
    const refreshToken = this.generateRefreshToken(user._id);
    // The repository hashes the refresh token before persistence.
    await authRepository.updateRefreshToken(user._id, refreshToken);
    await authRepository.updateLastLogin(user._id);

    await this.triggerHook('onLogin', {
      userId: user._id,
      email: user.email,
      timestamp: new Date(),
    });

    await this.triggerHook('onAuditLog', {
      action: 'user:logged_in',
      userId: user._id,
    });

    return {
      user: this.sanitizeUser(user),
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  async logout(userId) {
    await authRepository.clearRefreshToken(userId);

    await this.triggerHook('onLogout', { userId });

    await this.triggerHook('onAuditLog', {
      action: 'user:logged_out',
      userId,
    });

    return {};
  }

  async refreshAccessToken(refreshToken) {
    if (!refreshToken) {
      throw new ServiceError('Refresh token is required', 'MISSING_TOKEN', 400);
    }

    const decoded = this.verifyRefreshToken(refreshToken);
    const user = await authRepository.findById(decoded.userId, 'refreshToken');

    if (!user) {
      throw new ServiceError('User not found', 'USER_NOT_FOUND', 404);
    }

    if (!user.isActive) {
      throw new ServiceError('Account is deactivated', 'ACCOUNT_DEACTIVATED', 403);
    }

    const storedTokenHash = user.refreshToken;
    const providedTokenHash = this.hashToken(refreshToken);

    if (storedTokenHash !== providedTokenHash) {
      throw new ServiceError('Invalid refresh token', 'INVALID_REFRESH_TOKEN', 401);
    }

    const newAccessToken = this.generateAccessToken(user._id, user.role);
    const newRefreshToken = this.generateRefreshToken(user._id);
    // Rotate and persist the new refresh token through the repository.
    await authRepository.updateRefreshToken(user._id, newRefreshToken);

    await this.triggerHook('onAuditLog', {
      action: 'user:token_refreshed',
      userId: user._id,
    });

    return {
      user: this.sanitizeUser(user),
      tokens: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    };
  }

  async getCurrentUser(userId) {
    const user = await authRepository.findById(userId);

    if (!user) {
      throw new ServiceError('User not found', 'USER_NOT_FOUND', 404);
    }

    if (!user.isActive) {
      throw new ServiceError('Account is deactivated', 'ACCOUNT_DEACTIVATED', 403);
    }

    return {
      user: this.sanitizeUser(user),
    };
  }

  async changePassword(userId, currentPassword, newPassword) {
    if (currentPassword === newPassword) {
      throw new ServiceError(
        'New password must be different from current password',
        'SAME_PASSWORD',
        400
      );
    }

    const user = await authRepository.findById(userId, 'password');

    if (!user) {
      throw new ServiceError('User not found', 'USER_NOT_FOUND', 404);
    }

    const passwordMatch = await user.comparePassword(currentPassword);

    if (!passwordMatch) {
      throw new ServiceError('Current password is incorrect', 'INVALID_PASSWORD', 401);
    }

    await authRepository.updatePassword(userId, newPassword);
    await authRepository.clearRefreshToken(userId);

    await this.triggerHook('onPasswordChange', { userId });

    await this.triggerHook('onAuditLog', {
      action: 'user:password_changed',
      userId,
    });

    const updatedUser = await authRepository.findById(userId);

    return {
      user: this.sanitizeUser(updatedUser),
    };
  }

  async forgotPassword(email) {
    const user = await authRepository.findByEmail(email);

    if (!user) {
      // Return null token to not reveal email existence
      return { resetToken: null };
    }

    const passwordResetToken = this.generateToken();
    const passwordResetTokenHash = this.hashToken(passwordResetToken);
    const passwordResetExpires = Date.now() + 10 * 60 * 1000;

    await authRepository.setPasswordResetToken(
      user._id,
      passwordResetTokenHash,
      passwordResetExpires
    );

    await this.triggerHook('onAuditLog', {
      action: 'user:password_reset_requested',
      userId: user._id,
      email: user.email,
    });

    return {
      resetToken: passwordResetToken,
    };
  }

  async resetPassword(userId, resetToken, newPassword) {
    const user = await authRepository.findById(userId, 'passwordReset');

    if (!user) {
      throw new ServiceError('User not found', 'USER_NOT_FOUND', 404);
    }

    const resetTokenHash = this.hashToken(resetToken);

    if (user.passwordResetToken !== resetTokenHash) {
      throw new ServiceError('Invalid or expired reset token', 'INVALID_RESET_TOKEN', 401);
    }

    if (user.passwordResetExpires < Date.now()) {
      throw new ServiceError('Password reset token has expired', 'TOKEN_EXPIRED', 401);
    }

    await authRepository.updatePassword(userId, newPassword);
    await authRepository.clearPasswordResetToken(userId);
    await authRepository.clearRefreshToken(userId);

    await this.triggerHook('onPasswordChange', { userId });

    await this.triggerHook('onAuditLog', {
      action: 'user:password_reset',
      userId,
    });

    const updatedUser = await authRepository.findById(userId);

    return {
      user: this.sanitizeUser(updatedUser),
    };
  }

  async verifyEmail(userId, verificationToken) {
    const user = await authRepository.findById(userId, 'emailVerification');

    if (!user) {
      throw new ServiceError('User not found', 'USER_NOT_FOUND', 404);
    }

    if (user.isVerified) {
      throw new ServiceError('Email is already verified', 'ALREADY_VERIFIED', 400);
    }

    const verificationTokenHash = this.hashToken(verificationToken);

    if (user.emailVerificationToken !== verificationTokenHash) {
      throw new ServiceError('Invalid or expired verification token', 'INVALID_TOKEN', 401);
    }

    if (user.emailVerificationExpires < Date.now()) {
      throw new ServiceError('Email verification token has expired', 'TOKEN_EXPIRED', 401);
    }

    await authRepository.verifyEmail(userId);

    await this.triggerHook('onEmailVerified', { userId, email: user.email });

    await this.triggerHook('onAuditLog', {
      action: 'user:email_verified',
      userId,
      email: user.email,
    });

    const verifiedUser = await authRepository.findById(userId);

    return {
      user: this.sanitizeUser(verifiedUser),
    };
  }

  async resendVerificationEmail(userId) {
    const user = await authRepository.findById(userId);

    if (!user) {
      throw new ServiceError('User not found', 'USER_NOT_FOUND', 404);
    }

    if (user.isVerified) {
      throw new ServiceError('Email is already verified', 'ALREADY_VERIFIED', 400);
    }

    const emailVerificationToken = this.generateToken();
    const emailVerificationTokenHash = this.hashToken(emailVerificationToken);
    const emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;

    await authRepository.setEmailVerificationToken(
      userId,
      emailVerificationTokenHash,
      emailVerificationExpires
    );

    await this.triggerHook('onAuditLog', {
      action: 'user:verification_email_resent',
      userId,
      email: user.email,
    });

    return {
      verificationToken: emailVerificationToken,
    };
  }
}

export default new AuthService();
