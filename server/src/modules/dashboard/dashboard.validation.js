import { query } from "express-validator";
import validationMiddleware from "../../middleware/validation.middleware.js";

export const validateDashboardQuery = [
    query("range")
        .optional()
        .isIn(["7", "30", "90", "365"])
        .withMessage("range must be one of: 7, 30, 90, 365")
        .toInt(),
    query("recentLimit")
        .optional()
        .isInt({ min: 1, max: 20 })
        .withMessage("recentLimit must be between 1 and 20")
        .toInt(),
    validationMiddleware,
];
