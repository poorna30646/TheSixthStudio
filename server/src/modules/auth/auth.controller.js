import asyncHandler from "../../middleware/asyncHandler.js";
import authService from "./auth.service.js";
import {
  setRefreshTokenCookie,
  clearAuthCookies,
} from "../../config/cookies.js";
import HTTP_STATUS from "../../constants/httpStatus.js";

class AuthController {
  async register(req, res) {
    const { fullName, username, email, password, passwordConfirm } = req.body;
    const result = await authService.register({
      fullName,
      username,
      email,
      password,
      passwordConfirm,
    });

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Registration successful. Please verify your email.',
      data: { user: result.user },
    });
  }

  async login(req, res) {
    const { email, password } = req.body;
    const result = await authService.login(email, password);

    setRefreshTokenCookie(res, result.tokens.refreshToken);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Login successful',
      data: {
        user: result.user,
        accessToken: result.tokens.accessToken,
      },
    });
  }

  async logout(req, res) {
    await authService.logout(req.user.userId);
    clearAuthCookies(res);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Logout successful',
    });
  }

  async refreshAccessToken(req, res) {
    const refreshToken = req.cookies.refreshToken;
    const result = await authService.refreshAccessToken(refreshToken);

    setRefreshTokenCookie(res, result.tokens.refreshToken);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        user: result.user,
        accessToken: result.tokens.accessToken,
      },
    });
  }

  async getCurrentUser(req, res) {
    const result = await authService.getCurrentUser(req.user.userId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'User retrieved successfully',
      data: { user: result.user },
    });
  }

  async changePassword(req, res) {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(
      req.user.userId,
      currentPassword,
      newPassword
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Password changed successfully',
      data: { user: result.user },
    });
  }

  async forgotPassword(req, res) {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
      data: { resetToken: result.resetToken },
    });
  }

  async resetPassword(req, res) {
    const { resetToken, newPassword } = req.body;
    const userId = req.params.userId;
    const result = await authService.resetPassword(
      userId,
      resetToken,
      newPassword
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Password reset successfully',
      data: { user: result.user },
    });
  }

  async verifyEmail(req, res) {
    const { verificationToken } = req.body;
    const userId = req.params.userId;
    const result = await authService.verifyEmail(userId, verificationToken);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Email verified successfully',
      data: { user: result.user },
    });
  }

  async resendVerificationEmail(req, res) {
    const userId = req.user.userId;
    const result = await authService.resendVerificationEmail(userId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Verification email resent successfully',
      data: { verificationToken: result.verificationToken },
    });
  }

  // TODO: Add profile and account-management endpoints only when their
  // service contracts and routes are implemented.
}

const controller = new AuthController();

export const register = asyncHandler((req, res, next) => controller.register(req, res, next));
export const login = asyncHandler((req, res, next) => controller.login(req, res, next));
export const logout = asyncHandler((req, res, next) => controller.logout(req, res, next));
export const refreshAccessToken = asyncHandler((req, res, next) => controller.refreshAccessToken(req, res, next));
export const getCurrentUser = asyncHandler((req, res, next) => controller.getCurrentUser(req, res, next));
export const changePassword = asyncHandler((req, res, next) => controller.changePassword(req, res, next));
export const forgotPassword = asyncHandler((req, res, next) => controller.forgotPassword(req, res, next));
export const resetPassword = asyncHandler((req, res, next) => controller.resetPassword(req, res, next));
export const verifyEmail = asyncHandler((req, res, next) => controller.verifyEmail(req, res, next));
export const resendVerificationEmail = asyncHandler((req, res, next) => controller.resendVerificationEmail(req, res, next));
