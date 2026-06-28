import { validationResult } from "express-validator";
import ApiError from "../utils/ApiError.js";

const validationMiddleware = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return next(
            new ApiError(
                422,
                "Validation failed",
                errors.array()
            )
        );
    }

    next();
};

export default validationMiddleware;