import asyncHandler from "../../middleware/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import env from "../../config/env.js";
import {
  setRefreshTokenCookie,
  clearAuthCookies,
} from "../../config/cookies.js";
import authService from "./auth.service.js";

const developmentToken = (value) =>
  env.NODE_ENV === "development" ? value : undefined;

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  res.status(201).json(
    new ApiResponse(201, "Registration successful. Please verify your email.", {
      user: result.user,
      verificationToken: developmentToken(result.verificationToken),
    })
  );
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body.email, req.body.password);
  setRefreshTokenCookie(res, result.tokens.refreshToken);
  res.status(200).json(
    new ApiResponse(200, "Login successful", {
      user: result.user,
      accessToken: result.tokens.accessToken,
    })
  );
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user.userId);
  clearAuthCookies(res);
  res.status(200).json(new ApiResponse(200, "Logout successful"));
});

export const refreshAccessToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
  const result = await authService.refreshAccessToken(refreshToken);
  setRefreshTokenCookie(res, result.tokens.refreshToken);
  res.status(200).json(
    new ApiResponse(200, "Token refreshed successfully", {
      user: result.user,
      accessToken: result.tokens.accessToken,
    })
  );
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  const result = await authService.getCurrentUser(req.user.userId);
  res.status(200).json(
    new ApiResponse(200, "User retrieved successfully", result)
  );
});

export const changePassword = asyncHandler(async (req, res) => {
  const result = await authService.changePassword(
    req.user.userId,
    req.body.currentPassword,
    req.body.newPassword
  );
  clearAuthCookies(res);
  res.status(200).json(
    new ApiResponse(200, "Password changed successfully", result)
  );
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body.email);
  res.status(200).json(
    new ApiResponse(
      200,
      "If an account exists, password reset instructions have been generated.",
      { resetToken: developmentToken(result.resetToken) }
    )
  );
});

export const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(
    req.params.userId,
    req.body.resetToken,
    req.body.newPassword
  );
  clearAuthCookies(res);
  res.status(200).json(
    new ApiResponse(200, "Password reset successfully", result)
  );
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const result = await authService.verifyEmail(
    req.params.userId,
    req.body.verificationToken
  );
  res.status(200).json(
    new ApiResponse(200, "Email verified successfully", result)
  );
});

export const resendVerificationEmail = asyncHandler(async (req, res) => {
  const result = await authService.resendVerificationEmail(req.user.userId);
  res.status(200).json(
    new ApiResponse(200, "Verification email regenerated successfully", {
      verificationToken: developmentToken(result.verificationToken),
    })
  );
});
