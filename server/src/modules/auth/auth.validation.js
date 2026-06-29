import { body, param } from "express-validator";
import validationMiddleware from "../../middleware/validation.middleware.js";
import { PASSWORD_REGEX } from "../../constants/regex.js";

const password = (field, label) =>
  body(field)
    .isString()
    .withMessage(`${label} is required`)
    .matches(PASSWORD_REGEX)
    .withMessage(
      `${label} must contain uppercase, lowercase, number, and special character`
    );

export const validateRegister = [
  body("fullName")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Full name must be between 2 and 100 characters"),
  body("username")
    .trim()
    .toLowerCase()
    .matches(/^[a-z0-9_-]{3,30}$/)
    .withMessage(
      "Username must contain 3 to 30 lowercase letters, numbers, hyphens, or underscores"
    ),
  body("email")
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage("A valid email address is required"),
  password("password", "Password"),
  body("passwordConfirm")
    .isString()
    .custom((value, { req }) => value === req.body.password)
    .withMessage("Passwords do not match"),
  validationMiddleware,
];

export const validateLogin = [
  body("email")
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage("A valid email address is required"),
  body("password").isString().notEmpty().withMessage("Password is required"),
  validationMiddleware,
];

export const validateRefreshToken = [
  body().custom((_, { req }) => {
    if (!req.cookies?.refreshToken && !req.body?.refreshToken) {
      throw new Error("Refresh token is required");
    }
    return true;
  }),
  validationMiddleware,
];

export const validateChangePassword = [
  body("currentPassword")
    .isString()
    .notEmpty()
    .withMessage("Current password is required"),
  password("newPassword", "New password"),
  body("newPasswordConfirm")
    .isString()
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage("New passwords do not match"),
  validationMiddleware,
];

export const validateForgotPassword = [
  body("email")
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage("A valid email address is required"),
  validationMiddleware,
];

export const validateResetPassword = [
  param("userId").isMongoId().withMessage("A valid user ID is required"),
  body("resetToken")
    .trim()
    .isLength({ min: 32, max: 256 })
    .withMessage("A valid reset token is required"),
  password("newPassword", "New password"),
  body("newPasswordConfirm")
    .isString()
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage("New passwords do not match"),
  validationMiddleware,
];

export const validateVerifyEmail = [
  param("userId").isMongoId().withMessage("A valid user ID is required"),
  body("verificationToken")
    .trim()
    .isLength({ min: 32, max: 256 })
    .withMessage("A valid verification token is required"),
  validationMiddleware,
];
