import path from "node:path";
import { body } from "express-validator";
import validationMiddleware from "../../../middleware/validation.middleware.js";

const MB = 1024 * 1024;

const IMAGE_TYPES = Object.freeze({
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "image/webp": ["webp"],
    "image/gif": ["gif"],
    "image/avif": ["avif"],
});

const VIDEO_TYPES = Object.freeze({
    "video/mp4": ["mp4"],
    "video/webm": ["webm"],
    "video/quicktime": ["mov"],
    "video/x-matroska": ["mkv"],
});

const AUDIO_TYPES = Object.freeze({
    "audio/mpeg": ["mp3"],
    "audio/wav": ["wav"],
    "audio/x-wav": ["wav"],
    "audio/ogg": ["ogg", "oga"],
    "audio/mp4": ["m4a", "mp4"],
    "audio/aac": ["aac"],
    "audio/flac": ["flac"],
    "audio/webm": ["weba", "webm"],
});

const DOCUMENT_TYPES = Object.freeze({
    "application/json": ["json"],
    "application/pdf": ["pdf"],
    "application/zip": ["zip"],
    "application/x-zip-compressed": ["zip"],
});

const mergeMimeTypes = (...groups) => Object.assign({}, ...groups);

export const STORAGE_POLICIES = Object.freeze({
    avatars: Object.freeze({
        scope: "user",
        maxFileSize: 5 * MB,
        mimeTypes: IMAGE_TYPES,
    }),
    images: Object.freeze({
        scope: "project",
        maxFileSize: 20 * MB,
        mimeTypes: IMAGE_TYPES,
    }),
    videos: Object.freeze({
        scope: "project",
        maxFileSize: 500 * MB,
        mimeTypes: VIDEO_TYPES,
    }),
    audio: Object.freeze({
        scope: "project",
        maxFileSize: 100 * MB,
        mimeTypes: AUDIO_TYPES,
    }),
    thumbnails: Object.freeze({
        scope: "project",
        maxFileSize: 10 * MB,
        mimeTypes: IMAGE_TYPES,
    }),
    templates: Object.freeze({
        scope: "root",
        maxFileSize: 50 * MB,
        mimeTypes: mergeMimeTypes(IMAGE_TYPES, DOCUMENT_TYPES),
    }),
    voices: Object.freeze({
        scope: "root",
        maxFileSize: 100 * MB,
        mimeTypes: AUDIO_TYPES,
    }),
    exports: Object.freeze({
        scope: "root",
        maxFileSize: 1024 * MB,
        mimeTypes: mergeMimeTypes(
            IMAGE_TYPES,
            VIDEO_TYPES,
            AUDIO_TYPES,
            DOCUMENT_TYPES
        ),
    }),
    temp: Object.freeze({
        scope: "root",
        maxFileSize: 500 * MB,
        mimeTypes: mergeMimeTypes(
            IMAGE_TYPES,
            VIDEO_TYPES,
            AUDIO_TYPES,
            DOCUMENT_TYPES
        ),
    }),
});

const PROJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const STORAGE_KEY_PATTERN = /^[A-Za-z0-9._/-]+$/;

export const normalizeMimeType = (mimeType) =>
    String(mimeType || "")
        .split(";")[0]
        .trim()
        .toLowerCase();

export const getFileExtension = (fileName) =>
    path.extname(String(fileName || "")).slice(1).toLowerCase();

export const assertValidUploadMetadata = ({
    fileName,
    mimeType,
    fileSize,
    folder,
    projectId,
}) => {
    const policy = STORAGE_POLICIES[folder];

    if (!policy) {
        throw new Error(
            `Folder must be one of: ${Object.keys(STORAGE_POLICIES).join(", ")}`
        );
    }

    if (
        typeof fileName !== "string" ||
        !fileName.trim() ||
        fileName.length > 255 ||
        /[\/\\\0]/.test(fileName)
    ) {
        throw new Error(
            "File name must be between 1 and 255 characters and cannot contain a path"
        );
    }

    const extension = getFileExtension(fileName);
    if (!extension) {
        throw new Error("File name must include an extension");
    }

    const normalizedMimeType = normalizeMimeType(mimeType);
    const allowedExtensions = policy.mimeTypes[normalizedMimeType];

    if (!allowedExtensions) {
        throw new Error(
            `MIME type ${normalizedMimeType || "provided"} is not allowed in ${folder}`
        );
    }

    if (!allowedExtensions.includes(extension)) {
        throw new Error(
            `Extension .${extension} does not match MIME type ${normalizedMimeType}`
        );
    }

    const numericFileSize = Number(fileSize);
    if (
        !Number.isSafeInteger(numericFileSize) ||
        numericFileSize <= 0 ||
        numericFileSize > policy.maxFileSize
    ) {
        throw new Error(
            `File size must be between 1 byte and ${policy.maxFileSize} bytes for ${folder}`
        );
    }

    if (
        policy.scope === "project" &&
        (typeof projectId !== "string" ||
            !PROJECT_ID_PATTERN.test(projectId))
    ) {
        throw new Error(
            "A valid MongoDB projectId is required for project storage folders"
        );
    }

    if (policy.scope !== "project" && projectId !== undefined) {
        throw new Error(
            "projectId is only allowed for project storage folders"
        );
    }

    return {
        extension,
        mimeType: normalizedMimeType,
        fileSize: numericFileSize,
        policy,
    };
};

export const assertValidStorageKey = (key) => {
    if (
        typeof key !== "string" ||
        !key ||
        key.length > 1024 ||
        key.startsWith("/") ||
        key.endsWith("/") ||
        key.includes("\\") ||
        key.includes("//") ||
        !STORAGE_KEY_PATTERN.test(key) ||
        key.split("/").some((segment) => segment === "." || segment === "..")
    ) {
        throw new Error("A valid storage object key is required");
    }

    return key;
};

const uploadMetadataValidator = body().custom((_, { req }) => {
    assertValidUploadMetadata(req.body);
    return true;
});

const storageKeyValidator = body("key").custom((key) => {
    assertValidStorageKey(key);
    return true;
});

const expiresInValidator = body("expiresIn")
    .optional()
    .isInt({ min: 60, max: 3600 })
    .withMessage("expiresIn must be an integer between 60 and 3600 seconds")
    .toInt();

export const validateUploadUrl = [
    uploadMetadataValidator,
    expiresInValidator,
    validationMiddleware,
];

export const validateDownloadUrl = [
    storageKeyValidator,
    expiresInValidator,
    validationMiddleware,
];

export const validateDeleteObject = [
    storageKeyValidator,
    validationMiddleware,
];
