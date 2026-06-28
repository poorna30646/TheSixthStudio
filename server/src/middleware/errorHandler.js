import HTTP_STATUS from "../constants/httpStatus.js";

const errorHandler = (err, req, res, next) => {
    const statusCode =
        err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;

    res.status(statusCode).json({
        success: false,
        statusCode,
        message: err.message,
        errors: err.errors || [],
        stack:
            process.env.NODE_ENV === "development"
                ? err.stack
                : undefined,
        timestamp: new Date().toISOString(),
    });
};

export default errorHandler;