import { body, param, query } from "express-validator";
import validationMiddleware from "../../middleware/validation.middleware.js";
import { TEMPLATE_STATUSES } from "./template.model.js";

const SORT_FIELDS = [
    "createdAt",
    "updatedAt",
    "title",
    "category",
    "status",
];

const assertSafeObject = (value, depth = 0) => {
    if (depth > 6) throw new Error("metadata cannot exceed 6 nesting levels");
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
                throw new Error(`metadata contains an unsafe key: ${key}`);
            }
            assertSafeObject(nested, depth + 1);
        }
    }
};

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
        if (JSON.stringify(value).length > 20_000) {
            throw new Error("metadata cannot exceed 20,000 characters");
        }
        assertSafeObject(value);
        return true;
    });

const titleValidator = ({ optional = false } = {}) => {
    const validator = body("title");
    if (optional) validator.optional();
    return validator
        .trim()
        .isLength({ min: 2, max: 120 })
        .withMessage("title must contain 2 to 120 characters");
};

const descriptionValidator = body("description")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("description cannot exceed 2,000 characters");

const categoryValidator = ({ optional = false } = {}) => {
    const validator = body("category");
    if (optional) validator.optional();
    return validator
        .trim()
        .toLowerCase()
        .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .withMessage("category must be a lowercase slug")
        .isLength({ min: 2, max: 50 })
        .withMessage("category must contain 2 to 50 characters");
};

const assetsValidator = [
    body("assets")
        .isArray({ min: 1, max: 100 })
        .withMessage("assets must contain between 1 and 100 Asset IDs")
        .custom((ids) => {
            if (new Set(ids.map(String)).size !== ids.length) {
                throw new Error("assets cannot contain duplicate IDs");
            }
            return true;
        }),
    body("assets.*")
        .isMongoId()
        .withMessage("Every asset must be a valid MongoDB ID"),
];

const thumbnailValidator = body("thumbnail")
    .optional({ nullable: true })
    .isMongoId()
    .withMessage("thumbnail must be a valid Asset ID or null");

const statusValidator = body("status")
    .optional()
    .isIn(TEMPLATE_STATUSES)
    .withMessage(`status must be one of: ${TEMPLATE_STATUSES.join(", ")}`);

const publicValidator = body("isPublic")
    .optional()
    .isBoolean({ strict: true })
    .withMessage("isPublic must be a boolean");

const tagsValidator = [
    body("tags")
        .optional()
        .isArray({ max: 20 })
        .withMessage("tags must contain at most 20 values")
        .custom((tags) => {
            const normalized = tags.map((tag) =>
                typeof tag === "string" ? tag.trim().toLowerCase() : tag
            );
            if (new Set(normalized).size !== normalized.length) {
                throw new Error("tags cannot contain duplicates");
            }
            return true;
        }),
    body("tags.*")
        .trim()
        .toLowerCase()
        .isLength({ min: 1, max: 30 })
        .withMessage("Each tag must contain 1 to 30 characters"),
];

const allowedFields = new Set([
    "title",
    "description",
    "category",
    "assets",
    "thumbnail",
    "status",
    "isPublic",
    "tags",
    "metadata",
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

export const validateCreateTemplate = [
    titleValidator(),
    descriptionValidator,
    categoryValidator(),
    ...assetsValidator,
    thumbnailValidator,
    statusValidator,
    publicValidator,
    ...tagsValidator,
    metadataValidator,
    fieldsValidator(false),
    validationMiddleware,
];

export const validateUpdateTemplate = [
    param("templateId")
        .isMongoId()
        .withMessage("A valid templateId is required"),
    titleValidator({ optional: true }),
    descriptionValidator,
    categoryValidator({ optional: true }),
    body("assets")
        .optional()
        .isArray({ min: 1, max: 100 })
        .withMessage("assets must contain between 1 and 100 Asset IDs")
        .custom((ids) => {
            if (new Set(ids.map(String)).size !== ids.length) {
                throw new Error("assets cannot contain duplicate IDs");
            }
            return true;
        }),
    body("assets.*")
        .optional()
        .isMongoId()
        .withMessage("Every asset must be a valid MongoDB ID"),
    thumbnailValidator,
    statusValidator,
    publicValidator,
    ...tagsValidator,
    metadataValidator,
    fieldsValidator(true),
    validationMiddleware,
];

export const validateListTemplates = [
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
    query("search").optional().trim().isLength({ min: 1, max: 100 }),
    query("category")
        .optional()
        .trim()
        .toLowerCase()
        .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    query("status").optional().isIn(TEMPLATE_STATUSES),
    query("isPublic").optional().isBoolean().toBoolean(),
    query("tag").optional().trim().toLowerCase().isLength({ min: 1, max: 30 }),
    query("owner").optional().isMongoId(),
    query("sortBy").optional().isIn(SORT_FIELDS),
    query("sortOrder").optional().isIn(["asc", "desc"]),
    validationMiddleware,
];

export const validateTemplateId = [
    param("templateId")
        .isMongoId()
        .withMessage("A valid templateId is required"),
    validationMiddleware,
];
