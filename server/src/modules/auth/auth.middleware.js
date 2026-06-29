import asyncHandler from "../../middleware/asyncHandler.js";
import ApiError from "../../utils/ApiError.js";
import authService from "./auth.service.js";
import authRepository from "./auth.repository.js";

const getAccessToken = (req) => {
  const authorization = req.get("authorization");
  if (authorization) {
    const match = authorization.match(/^Bearer\s+(\S+)$/i);
    if (!match) throw new ApiError(401, "Authorization header is invalid");
    return match[1];
  }
  return req.cookies?.accessToken;
};

export const protect = asyncHandler(async (req, res, next) => {
  const token = getAccessToken(req);
  if (!token) throw new ApiError(401, "Authentication is required");

  let decoded;
  try {
    decoded = authService.verifyAccessToken(token);
  } catch (error) {
    throw new ApiError(401, error.message);
  }

  const user = await authRepository.findById(decoded.userId);
  if (!user || !user.isActive) {
    throw new ApiError(401, "The authenticated account is unavailable");
  }
  if (user.changedPasswordAfter(decoded.iat)) {
    throw new ApiError(401, "Password changed; please log in again");
  }

  req.user = {
    userId: String(user._id),
    role: user.role,
    iat: decoded.iat,
  };
  next();
});

export const requireAdmin = asyncHandler((req, res, next) => {
  if (!req.user) throw new ApiError(401, "Authentication is required");
  if (req.user.role !== "admin") {
    throw new ApiError(403, "Admin access is required");
  }
  next();
});
