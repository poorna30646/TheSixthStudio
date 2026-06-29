import HTTP_STATUS from "../constants/httpStatus.js";
import env from "../config/env.js";
import logger from "../config/logger.js";

const errorHandler = (err, req, res, next) => {
    if (res.headersSent) return next(err);

    let statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    let message = err.message || "Internal server error";
    let errors = err.errors || [];

    if (err.name === "CastError") {
        statusCode = HTTP_STATUS.BAD_REQUEST;
        message = `Invalid ${err.path}`;
    } else if (err.name === "ValidationError") {
        statusCode = HTTP_STATUS.UNPROCESSABLE_ENTITY;
        message = "Validation failed";
        errors = Object.values(err.errors).map((error) => ({
            field: error.path,
            message: error.message,
        }));
    } else if (err.code === 11000) {
        statusCode = HTTP_STATUS.CONFLICT;
        message = "A record with that value already exists";
    }

    if (statusCode >= 500) {
        logger.error(`${req.method} ${req.originalUrl}: ${err.stack || message}`);
        if (env.NODE_ENV === "production") message = "Internal server error";
    }

    res.status(statusCode).json({
        success: false,
        statusCode,
        message,
        errors,
        stack:
            env.NODE_ENV === "development"
                ? err.stack
                : undefined,
        timestamp: new Date().toISOString(),
    });
};

export default errorHandler;
