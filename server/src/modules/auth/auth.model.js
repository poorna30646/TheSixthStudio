import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';
import crypto from 'crypto';

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters'],
      maxlength: [100, 'Full name must not exceed 100 characters'],
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      lowercase: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username must not exceed 30 characters'],
      match: [
        /^[a-z0-9_-]{3,30}$/,
        'Username can only contain lowercase letters, numbers, hyphens, and underscores',
      ],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address',
      ],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    avatar: {
      url: { type: String, default: null },
      key: { type: String, default: null },
      size: { type: Number, default: null },
      mimeType: { type: String, default: null },
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'moderator'],
      default: 'user',
    },
    provider: {
      type: String,
      enum: ['email', 'google', 'github'],
      default: 'email',
    },
    plan: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      default: 'free',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    refreshToken: {
      type: String,
      select: false,
      default: null,
    },
    storageUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    storageLimit: {
      type: Number,
      default: 5368709120,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    emailVerificationToken: {
      type: String,
      select: false,
      default: null,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
      default: null,
    },
    passwordResetToken: {
      type: String,
      select: false,
      default: null,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
      default: null,
    },
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    loginAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    lockUntil: {
      type: Date,
      select: false,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ provider: 1 });
userSchema.index({ isVerified: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

userSchema.pre('save', async function () {
  if (this.isModified('password')) {
    const salt = await bcryptjs.genSalt(10);
    this.password = await bcryptjs.hash(this.password, salt);
    this.passwordChangedAt = new Date();
  }

  if (this.isModified('refreshToken') && this.refreshToken != null) {
    this.refreshToken = crypto
      .createHash('sha256')
      .update(this.refreshToken)
      .digest('hex');
  }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcryptjs.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Error comparing passwords');
  }
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = Math.floor(this.passwordChangedAt.getTime() / 1000);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  const rawToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  return rawToken;
};

userSchema.methods.createEmailVerificationToken = function () {
  const rawToken = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
  return rawToken;
};

userSchema.methods.verifyEmailToken = function (token) {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return (
    this.emailVerificationToken === hash &&
    this.emailVerificationExpires > Date.now()
  );
};

userSchema.methods.verifyPasswordResetToken = function (token) {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return (
    this.passwordResetToken === hash &&
    this.passwordResetExpires > Date.now()
  );
};

userSchema.methods.verifyRefreshToken = function (token) {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return this.refreshToken === hash;
};

userSchema.statics.findByRefreshToken = function (token) {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return this.findOne({ refreshToken: hash });
};

userSchema.methods.incrementLoginAttempts = async function () {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1, lockUntil: null },
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  const maxAttempts = 5;
  const lockTime = 30 * 60 * 1000;

  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }

  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = async function () {
  return this.updateOne({
    $set: { loginAttempts: 0, lockUntil: null },
  });
};

userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.refreshToken;
  delete userObject.emailVerificationToken;
  delete userObject.emailVerificationExpires;
  delete userObject.passwordResetToken;
  delete userObject.passwordResetExpires;
  delete userObject.loginAttempts;
  delete userObject.lockUntil;
  return userObject;
};

userSchema.set('toJSON', { virtuals: false });

const User = mongoose.model('User', userSchema);

export default User;
