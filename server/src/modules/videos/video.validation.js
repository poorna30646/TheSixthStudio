import { body, param, query } from "express-validator";
import validationMiddleware from "../../middleware/validation.middleware.js";
import { VIDEO_STATUSES } from "./video.model.js";

const SORT_FIELDS = [
    "createdAt",
    "updatedAt",
    "status",
    "renderProgress",
    "duration",
];

const inspectTimeline = (value, state, depth = 0) => {
    if (depth > 12) throw new Error("timeline cannot exceed 12 nesting levels");
    state.nodes += 1;
    if (state.nodes > 10_000) {
        throw new Error("timeline contains too many elements");
    }
    if (Array.isArray(value)) {
        value.forEach((item) => inspectTimeline(item, state, depth + 1));
        return;
    }
    if (value && typeof value === "object") {
        for (const [key, nested] of Object.entries(value)) {
            if (
                key.startsWith("$") ||
                key.includes(".") ||
                ["__proto__", "prototype", "constructor"].includes(key)
            ) {
                throw new Error(`timeline contains an unsafe key: ${key}`);
            }
            inspectTimeline(nested, state, depth + 1);
        }
    }
};

const timelineValidator = (optional = false) => {
    const validator = body("timeline");
    if (optional) validator.optional();
    return validator.custom((value) => {
        if (
            !value ||
            typeof value !== "object" ||
            Array.isArray(value) ||
            Object.getPrototypeOf(value) !== Object.prototype
        ) {
            throw new Error("timeline must be a plain object");
        }
        if (JSON.stringify(value).length > 500_000) {
            throw new Error("timeline cannot exceed 500,000 characters");
        }
        inspectTimeline(value, { nodes: 0 });
        return true;
    });
};

const assetsValidator = (optional = false) => {
    const validator = body("assets");
    if (optional) validator.optional();
    return validator
        .isArray({ min: 1, max: 500 })
        .withMessage("assets must contain between 1 and 500 Asset IDs")
        .custom((ids) => {
            if (new Set(ids.map(String)).size !== ids.length) {
                throw new Error("assets cannot contain duplicate IDs");
            }
            return true;
        });
};

const referenceValidator = (field, optional = true) => {
    const validator = body(field);
    if (optional) validator.optional({ nullable: true });
    return validator
        .isMongoId()
        .withMessage(`${field} must be a valid MongoDB ID or null`);
};

const durationValidator = (optional = false) => {
    const validator = body("duration");
    if (optional) validator.optional();
    return validator
        .isFloat({ min: 0.01, max: 86400 })
        .withMessage("duration must be between 0.01 and 86,400 seconds")
        .toFloat();
};

const allowedFields = new Set([
    "project",
    "timeline",
    "assets",
    "voice",
    "template",
    "thumbnail",
    "duration",
]);

const fieldsValidator = (requireValue) =>
    body().custom((value) => {
        const keys = Object.keys(value);
        if (requireValue && !keys.length) {
            throw new Error("At least one update field is required");
        }
        const unknown = keys.filter((key) => !allowedFields.has(key));
        if (unknown.length) {
            throw new Error(`Unknown fields: ${unknown.join(", ")}`);
        }
        return true;
    });

export const validateCreateVideo = [
    referenceValidator("project", false),
    timelineValidator(),
    assetsValidator(),
    body("assets.*")
        .isMongoId()
        .withMessage("Every asset must be a valid MongoDB ID"),
    referenceValidator("voice"),
    referenceValidator("template"),
    referenceValidator("thumbnail"),
    durationValidator(),
    fieldsValidator(false),
    validationMiddleware,
];

export const validateUpdateVideo = [
    param("videoId")
        .isMongoId()
        .withMessage("A valid videoId is required"),
    timelineValidator(true),
    assetsValidator(true),
    body("assets.*")
        .optional()
        .isMongoId()
        .withMessage("Every asset must be a valid MongoDB ID"),
    referenceValidator("voice"),
    referenceValidator("template"),
    referenceValidator("thumbnail"),
    durationValidator(true),
    body("project")
        .not()
        .exists()
        .withMessage("project cannot be changed after video creation"),
    fieldsValidator(true),
    validationMiddleware,
];

export const validateListVideos = [
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
    query("project").optional().isMongoId(),
    query("status").optional().isIn(VIDEO_STATUSES),
    query("voice").optional().isMongoId(),
    query("template").optional().isMongoId(),
    query("owner").optional().isMongoId(),
    query("minDuration")
        .optional()
        .isFloat({ min: 0.01, max: 86400 })
        .toFloat(),
    query("maxDuration")
        .optional()
        .isFloat({ min: 0.01, max: 86400 })
        .toFloat(),
    query().custom((value) => {
        if (
            value.minDuration !== undefined &&
            value.maxDuration !== undefined &&
            Number(value.minDuration) > Number(value.maxDuration)
        ) {
            throw new Error("minDuration cannot exceed maxDuration");
        }
        return true;
    }),
    query("sortBy").optional().isIn(SORT_FIELDS),
    query("sortOrder").optional().isIn(["asc", "desc"]),
    validationMiddleware,
];

export const validateVideoId = [
    param("videoId")
        .isMongoId()
        .withMessage("A valid videoId is required"),
    validationMiddleware,
];
