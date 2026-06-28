import express from "express";
import * as authController from "./auth.controller.js";
import * as authValidation from "./auth.validation.js";
import * as authMiddleware from "./auth.middleware.js";

const router = express.Router();

// Authentication
router.post(
  "/register",
  authValidation.validateRegister,
  authController.register
);

router.post(
  "/login",
  authValidation.validateLogin,
  authController.login
);

router.post(
  "/logout",
  authMiddleware.protect,
  authController.logout
);

router.post(
  "/refresh-token",
  authController.refreshAccessToken
);

// User
router.get(
  "/me",
  authMiddleware.protect,
  authController.getCurrentUser
);

router.post(
  "/change-password",
  authMiddleware.protect,
  authValidation.validateChangePassword,
  authController.changePassword
);

// Password
router.post(
  "/forgot-password",
  authValidation.validateForgotPassword,
  authController.forgotPassword
);

router.post(
  "/reset-password/:userId",
  authValidation.validateResetPassword,
  authController.resetPassword
);

// Email
router.post(
  "/verify-email/:userId",
  authValidation.validateVerifyEmail,
  authController.verifyEmail
);

router.post(
  "/resend-verification",
  authMiddleware.protect,
  authController.resendVerificationEmail
);


export default router;
