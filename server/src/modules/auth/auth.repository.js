import crypto from 'crypto';
import User from './auth.model.js';
import ApiError from '../../utils/ApiError.js';

const USER_PROJECTIONS = Object.freeze({
  WITH_PASSWORD: '+password',
  WITH_SENSITIVE:
    '+password +refreshToken +emailVerificationToken +emailVerificationExpires ' +
    '+passwordResetToken +passwordResetExpires +loginAttempts +lockUntil',
  WITH_REFRESH_TOKEN: '+refreshToken',
  WITH_EMAIL_VERIFICATION:
    '+emailVerificationToken +emailVerificationExpires',
  WITH_PASSWORD_RESET: '+passwordResetToken +passwordResetExpires',
  WITH_LOGIN_ATTEMPTS: '+loginAttempts +lockUntil',
});

const USER_UPDATABLE_FIELDS = Object.freeze([
  'fullName',
  'avatar',
  'role',
  'plan',
  'isActive',
]);

const VALID_PLANS = Object.freeze(['free', 'pro', 'enterprise']);

class AuthRepository {
  constructor(model) {
    this.model = model;
    this.auditHooks = [];
  }

  createError(statusCode, message) {
    return new ApiError(statusCode, message);
  }

  registerAuditHook(callback) {
    if (typeof callback === 'function') {
      this.auditHooks.push(callback);
    }
  }

  async triggerAuditHooks(action, data) {
    for (const hook of this.auditHooks) {
      try {
        await hook(action, data);
      } catch (error) {
        console.error(`[AUTH REPOSITORY HOOK ERROR] ${action}:`, error.message);
      }
    }
  }

  applySelection(query, includeFields) {
    if (!includeFields) {
      return query;
    }

    const selection = {
      password: USER_PROJECTIONS.WITH_PASSWORD,
      sensitive: USER_PROJECTIONS.WITH_SENSITIVE,
      refreshToken: USER_PROJECTIONS.WITH_REFRESH_TOKEN,
      emailVerification: USER_PROJECTIONS.WITH_EMAIL_VERIFICATION,
      passwordReset: USER_PROJECTIONS.WITH_PASSWORD_RESET,
      loginAttempts: USER_PROJECTIONS.WITH_LOGIN_ATTEMPTS,
    }[includeFields] || includeFields;

    return query.select(selection);
  }

  applySession(query, session) {
    if (session) {
      query.session(session);
    }

    return query;
  }

  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async findById(userId, includeFields = null, session = null) {
    const query = this.applySelection(
      this.model.findById(userId),
      includeFields
    );

    return this.applySession(query, session);
  }

  async findByIdLean(userId, includeFields = null) {
    return this.applySelection(
      this.model.findById(userId),
      includeFields
    ).lean();
  }

  async findByEmail(email, includeFields = null, session = null) {
    const query = this.applySelection(
      this.model.findOne({ email: email.toLowerCase() }),
      includeFields
    );

    return this.applySession(query, session);
  }

  async findByEmailLean(email, includeFields = null) {
    return this.applySelection(
      this.model.findOne({ email: email.toLowerCase() }),
      includeFields
    ).lean();
  }

  async findByUsername(username, includeFields = null, session = null) {
    const query = this.applySelection(
      this.model.findOne({ username: username.toLowerCase() }),
      includeFields
    );

    return this.applySession(query, session);
  }

  async findByUsernameLean(username, includeFields = null) {
    return this.applySelection(
      this.model.findOne({ username: username.toLowerCase() }),
      includeFields
    ).lean();
  }

  async findByRefreshToken(refreshToken, session = null) {
    const query = this.model
      .findOne({ refreshToken: this.hashToken(refreshToken) })
      .select(USER_PROJECTIONS.WITH_REFRESH_TOKEN);

    return this.applySession(query, session);
  }

  async findByEmailVerificationToken(token, session = null) {
    const query = this.model
      .findOne({ emailVerificationToken: token })
      .select(USER_PROJECTIONS.WITH_EMAIL_VERIFICATION);

    return this.applySession(query, session);
  }

  async findByPasswordResetToken(token, session = null) {
    const query = this.model
      .findOne({ passwordResetToken: token })
      .select(USER_PROJECTIONS.WITH_PASSWORD_RESET);

    return this.applySession(query, session);
  }

  async create(userData, session = null) {
    try {
      const user = new this.model(userData);
      await user.save({ session });
      await this.triggerAuditHooks('user:created', { userId: user._id });
      return user;
    } catch (error) {
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern || error.keyValue || {})[0];
        throw this.createError(
          409,
          field ? `${field} already exists` : 'User already exists'
        );
      }

      if (error instanceof ApiError) {
        throw error;
      }

      throw this.createError(422, `Failed to create user: ${error.message}`);
    }
  }

  async updateById(userId, updateData, session = null) {
    const filteredData = Object.fromEntries(
      Object.entries(updateData).filter(([key]) =>
        USER_UPDATABLE_FIELDS.includes(key)
      )
    );

    if (Object.keys(filteredData).length === 0) {
      return this.findById(userId, null, session);
    }

    try {
      const query = this.model.findByIdAndUpdate(userId, filteredData, {
        new: true,
        runValidators: true,
      });
      const user = await this.applySession(query, session);

      if (!user) {
        throw this.createError(404, 'User not found');
      }

      await this.triggerAuditHooks('user:updated', {
        userId,
        changes: filteredData,
      });
      return user;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw this.createError(422, `Failed to update user: ${error.message}`);
    }
  }

  async updatePassword(userId, newPassword, session = null) {
    const user = await this.findById(userId, null, session);

    if (!user) {
      throw this.createError(404, 'User not found');
    }

    user.password = newPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    user.loginAttempts = 0;
    user.lockUntil = null;

    await user.save({ session });
    await this.triggerAuditHooks('user:password_changed', { userId });
    return user;
  }

  async updateRefreshToken(userId, refreshToken, session = null) {
    const hashedRefreshToken = refreshToken
      ? this.hashToken(refreshToken)
      : null;
    const query = this.model.findByIdAndUpdate(
      userId,
      { refreshToken: hashedRefreshToken },
      { new: true }
    );
    const user = await this.applySession(query, session);

    if (!user) {
      throw this.createError(404, 'User not found');
    }

    return user;
  }

  async clearRefreshToken(userId, session = null) {
    const user = await this.updateRefreshToken(userId, null, session);
    await this.triggerAuditHooks('user:refresh_token_cleared', { userId });
    return user;
  }

  async updateLastLogin(userId, session = null) {
    const query = this.model.findByIdAndUpdate(
      userId,
      { lastLogin: Date.now(), loginAttempts: 0, lockUntil: null },
      { new: true }
    );
    const user = await this.applySession(query, session);

    if (!user) {
      throw this.createError(404, 'User not found');
    }

    await this.triggerAuditHooks('user:login_success', { userId });
    return user;
  }

  async updateStorageUsed(userId, storageAmount, session = null) {
    const user = await this.findById(userId, null, session);

    if (!user) {
      throw this.createError(404, 'User not found');
    }

    user.storageUsed = Math.max(0, user.storageUsed + storageAmount);
    await user.save({ session });
    await this.triggerAuditHooks('user:storage_updated', {
      userId,
      amount: storageAmount,
      newTotal: user.storageUsed,
    });
    return user;
  }

  async setStorageUsed(userId, storageAmount, session = null) {
    const query = this.model.findByIdAndUpdate(
      userId,
      { storageUsed: Math.max(0, storageAmount) },
      { new: true, runValidators: true }
    );
    const user = await this.applySession(query, session);

    if (!user) {
      throw this.createError(404, 'User not found');
    }

    return user;
  }

  async verifyEmail(userId, session = null) {
    const query = this.model.findByIdAndUpdate(
      userId,
      {
        isVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
      { new: true }
    );
    const user = await this.applySession(query, session);

    if (!user) {
      throw this.createError(404, 'User not found');
    }

    await this.triggerAuditHooks('user:email_verified', { userId });
    return user;
  }

  async setEmailVerificationToken(
    userId,
    token,
    expiresAt,
    session = null
  ) {
    const query = this.model.findByIdAndUpdate(
      userId,
      { emailVerificationToken: token, emailVerificationExpires: expiresAt },
      { new: true }
    );
    const user = await this.applySession(query, session);

    if (!user) {
      throw this.createError(404, 'User not found');
    }

    return user;
  }

  async setPasswordResetToken(userId, token, expiresAt, session = null) {
    const query = this.model.findByIdAndUpdate(
      userId,
      { passwordResetToken: token, passwordResetExpires: expiresAt },
      { new: true }
    );
    const user = await this.applySession(query, session);

    if (!user) {
      throw this.createError(404, 'User not found');
    }

    return user;
  }

  async clearPasswordResetToken(userId, session = null) {
    const query = this.model.findByIdAndUpdate(
      userId,
      { passwordResetToken: null, passwordResetExpires: null },
      { new: true }
    );
    const user = await this.applySession(query, session);

    if (!user) {
      throw this.createError(404, 'User not found');
    }

    return user;
  }

  async incrementLoginAttempts(userId, session = null) {
    const user = await this.findById(userId, 'loginAttempts', session);

    if (!user) {
      throw this.createError(404, 'User not found');
    }

    await user.incrementLoginAttempts();
    await this.triggerAuditHooks('user:login_attempt_failed', { userId });
    return user;
  }

  async resetLoginAttempts(userId, session = null) {
    const user = await this.findById(userId, 'loginAttempts', session);

    if (!user) {
      throw this.createError(404, 'User not found');
    }

    await user.resetLoginAttempts();
    return user;
  }

  async isAccountLocked(userId, session = null) {
    const user = await this.findById(userId, 'loginAttempts', session);
    return user ? Boolean(user.isLocked()) : false;
  }

  async delete(userId, session = null) {
    const user = await this.applySession(
      this.model.findByIdAndDelete(userId),
      session
    );

    if (user) {
      await this.triggerAuditHooks('user:deleted', { userId });
    }

    return user;
  }

  async softDelete(userId, session = null) {
    const user = await this.updateById(userId, { isActive: false }, session);
    await this.triggerAuditHooks('user:deactivated', { userId });
    return user;
  }

  async restore(userId, session = null) {
    const user = await this.updateById(userId, { isActive: true }, session);
    await this.triggerAuditHooks('user:reactivated', { userId });
    return user;
  }

  async existsByEmail(email) {
    return this.model.exists({ email: email.toLowerCase() });
  }

  async existsByUsername(username) {
    return this.model.exists({ username: username.toLowerCase() });
  }

  async findByFilters(filters = {}, pagination = {}) {
    const limit = Math.min(
      Math.max(Number.parseInt(pagination.limit, 10) || 20, 1),
      100
    );
    const page = Math.max(Number.parseInt(pagination.page, 10) || 1, 1);
    const skip = (page - 1) * limit;
    const queryFilters = { isActive: true };

    if (typeof filters.role === 'string') {
      queryFilters.role = filters.role;
    }

    if (VALID_PLANS.includes(filters.plan)) {
      queryFilters.plan = filters.plan;
    }

    if (typeof filters.isVerified === 'boolean') {
      queryFilters.isVerified = filters.isVerified;
    }

    if (typeof filters.search === 'string' && filters.search.trim()) {
      const search = filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      queryFilters.$or = [
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.model
        .find(queryFilters)
        .limit(limit)
        .skip(skip)
        .sort({ createdAt: -1 })
        .lean(),
      this.model.countDocuments(queryFilters),
    ]);

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  registerCacheInvalidationHook(cacheService) {
    this.registerAuditHook(async (action, data) => {
      const cacheableActions = [
        'user:created',
        'user:updated',
        'user:deleted',
        'user:password_changed',
        'user:email_verified',
      ];

      if (cacheableActions.includes(action) && data.userId) {
        cacheService?.invalidate(`user:id:${data.userId}`);
      }
    });
  }
}

export default new AuthRepository(User);
