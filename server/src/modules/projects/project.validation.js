import { body, param, query } from "express-validator";
import validationMiddleware from "../../middleware/validation.middleware.js";
import {
    PROJECT_STATUSES,
    PROJECT_VISIBILITIES,
} from "./project.model.js";

const SORT_FIELDS = [
    "createdAt",
    "updatedAt",
    "title",
    "status",
    "visibility",
];

const assertSafeObject = (value, depth = 0) => {
    if (depth > 6) throw new Error("settings cannot exceed 6 nesting levels");
    if (Array.isArray(value)) {
        value.forEach((item) => assertSafeObject(item, depth + 1));
        return;
    }
    if (value && typeof value === "object") {
        for (const [key, nested] of Object.entries(value)) {
            if (
                key.startsWith("$") ||
                key.includes(".") ||
                ["__proto__", "prototype", "constructor"].includes(key)
            ) {
                throw new Error(`settings contains an unsafe key: ${key}`);
            }
            assertSafeObject(nested, depth + 1);
        }
    }
};

const settingsValidator = body("settings")
    .optional()
    .custom((value) => {
        if (
            !value ||
            typeof value !== "object" ||
            Array.isArray(value) ||
            Object.getPrototypeOf(value) !== Object.prototype
        ) {
            throw new Error("settings must be a plain object");
        }
        if (JSON.stringify(value).length > 20_000) {
            throw new Error("settings cannot exceed 20,000 characters");
        }
        assertSafeObject(value);
        return true;
    });

const projectIdValidator = param("projectId")
    .isMongoId()
    .withMessage("A valid projectId is required");

const noUnknownFields = (allowedFields) =>
    body().custom((value) => {
        const allowed = new Set(allowedFields);
        const unknown = Object.keys(value).filter((key) => !allowed.has(key));
        if (unknown.length) {
            throw new Error(`Unknown fields: ${unknown.join(", ")}`);
        }
        return true;
    });

export const validateCreateProject = [
    body("title")
        .trim()
        .isLength({ min: 2, max: 120 })
        .withMessage("title must contain 2 to 120 characters"),
    body("description")
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage("description cannot exceed 2,000 characters"),
    body("visibility")
        .optional()
        .isIn(PROJECT_VISIBILITIES)
        .withMessage(
            `visibility must be one of: ${PROJECT_VISIBILITIES.join(", ")}`
        ),
    settingsValidator,
    noUnknownFields(["title", "description", "visibility", "settings"]),
    validationMiddleware,
];

export const validateUpdateProject = [
    projectIdValidator,
    body("title")
        .optional()
        .trim()
        .isLength({ min: 2, max: 120 })
        .withMessage("title must contain 2 to 120 characters"),
    body("description")
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage("description cannot exceed 2,000 characters"),
    body("thumbnail")
        .optional({ nullable: true })
        .isMongoId()
        .withMessage("thumbnail must be a valid Asset ID or null"),
    body("visibility")
        .optional()
        .isIn(PROJECT_VISIBILITIES)
        .withMessage(
            `visibility must be one of: ${PROJECT_VISIBILITIES.join(", ")}`
        ),
    settingsValidator,
    body().custom((value) => {
        const allowed = new Set([
            "title",
            "description",
            "thumbnail",
            "visibility",
            "settings",
        ]);
        const keys = Object.keys(value);
        if (!keys.length) throw new Error("At least one update field is required");
        const unknown = keys.filter((key) => !allowed.has(key));
        if (unknown.length) {
            throw new Error(`Unknown fields: ${unknown.join(", ")}`);
        }
        return true;
    }),
    validationMiddleware,
];

export const validateListProjects = [
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
    query("search").optional().trim().isLength({ min: 1, max: 100 }),
    query("visibility").optional().isIn(PROJECT_VISIBILITIES),
    query("status").optional().isIn(PROJECT_STATUSES),
    query("owner").optional().isMongoId(),
    query("includeDeleted").optional().isBoolean().toBoolean(),
    query("sortBy").optional().isIn(SORT_FIELDS),
    query("sortOrder").optional().isIn(["asc", "desc"]),
    validationMiddleware,
];

export const validateProjectId = [projectIdValidator, validationMiddleware];
