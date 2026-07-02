import { body, param, query } from "express-validator";
import validationMiddleware from "../../middleware/validation.middleware.js";
import {
    ASSET_CATEGORIES,
    ASSET_STATUSES,
    ASSET_TYPES,
} from "./asset.model.js";
import { assertValidStorageKey } from "../storage/validators/storage.validation.js";

const SORT_FIELDS = [
    "createdAt",
    "updatedAt",
    "size",
    "type",
    "category",
    "status",
    "mimeType",
];

const assertSafeMetadata = (value, depth = 0) => {
    if (depth > 6) {
        throw new Error("metadata cannot exceed 6 levels of nesting");
    }
    if (Array.isArray(value)) {
        value.forEach((item) => assertSafeMetadata(item, depth + 1));
        return;
    }
    if (value && typeof value === "object") {
        for (const [key, nestedValue] of Object.entries(value)) {
            if (
                key.startsWith("$") ||
                key.includes(".") ||
                ["__proto__", "prototype", "constructor"].includes(key)
            ) {
                throw new Error(`metadata contains an unsafe key: ${key}`);
            }
            assertSafeMetadata(nestedValue, depth + 1);
        }
    }
};

const mongoIdParam = param("assetId")
    .isMongoId()
    .withMessage("A valid assetId is required");

const metadataValidator = body("metadata")
    .optional()
    .custom((value) => {
        if (
            !value ||
            typeof value !== "object" ||
            Array.isArray(value) ||
            Object.getPrototypeOf(value) !== Object.prototype
        ) {
            throw new Error("metadata must be a plain object");
        }
        if (JSON.stringify(value).length > 10_000) {
            throw new Error("metadata cannot exceed 10,000 characters");
        }
        assertSafeMetadata(value);
        return true;
    });

export const validateCreateAsset = [
    body("key").custom((key) => {
        assertValidStorageKey(key);
        return true;
    }),
    metadataValidator,
    body("isPublic")
        .optional()
        .isBoolean({ strict: true })
        .withMessage("isPublic must be a boolean"),
    body().custom((value) => {
        const allowed = new Set(["key", "metadata", "isPublic"]);
        const unknown = Object.keys(value).filter((key) => !allowed.has(key));
        if (unknown.length) {
            throw new Error(`Unknown fields: ${unknown.join(", ")}`);
        }
        return true;
    }),
    validationMiddleware,
];

export const validateListAssets = [
    query("page")
        .optional()
        .isInt({ min: 1 })
        .withMessage("page must be a positive integer")
        .toInt(),
    query("limit")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("limit must be between 1 and 100")
        .toInt(),
    query("search")
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage("search must contain 1 to 100 characters"),
    query("user")
        .optional()
        .isMongoId()
        .withMessage("user must be a valid MongoDB ID"),
    query("project")
        .optional()
        .isMongoId()
        .withMessage("project must be a valid MongoDB ID"),
    query("type")
        .optional()
        .isIn(ASSET_TYPES)
        .withMessage(`type must be one of: ${ASSET_TYPES.join(", ")}`),
    query("category")
        .optional()
        .isIn(ASSET_CATEGORIES)
        .withMessage(
            `category must be one of: ${ASSET_CATEGORIES.join(", ")}`
        ),
    query("status")
        .optional()
        .isIn(ASSET_STATUSES.filter((status) => status !== "deleted"))
        .withMessage("status must be pending, ready, or failed"),
    query("mimeType")
        .optional()
        .trim()
        .matches(/^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/i)
        .withMessage("mimeType is invalid")
        .toLowerCase(),
    query("extension")
        .optional()
        .trim()
        .matches(/^[a-z0-9]{1,10}$/i)
        .withMessage("extension is invalid")
        .toLowerCase(),
    query("isPublic")
        .optional()
        .isBoolean()
        .withMessage("isPublic must be true or false")
        .toBoolean(),
    query("sortBy")
        .optional()
        .isIn(SORT_FIELDS)
        .withMessage(`sortBy must be one of: ${SORT_FIELDS.join(", ")}`),
    query("sortOrder")
        .optional()
        .isIn(["asc", "desc"])
        .withMessage("sortOrder must be asc or desc"),
    validationMiddleware,
];

export const validateAssetId = [mongoIdParam, validationMiddleware];

export const validateUpdateAsset = [
    mongoIdParam,
    metadataValidator,
    body("isPublic")
        .optional()
        .isBoolean({ strict: true })
        .withMessage("isPublic must be a boolean"),
    body().custom((value) => {
        const allowed = new Set(["metadata", "isPublic"]);
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
