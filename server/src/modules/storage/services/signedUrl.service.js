import {
    GetObjectCommand,
    HeadObjectCommand,
    PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import ApiError from "../../../utils/ApiError.js";
import s3Client, {
    S3_BUCKET_NAME,
    S3_ROOT_FOLDER,
} from "../config/s3.config.js";
import { assertValidStorageKey } from "../validators/storage.validation.js";

const DEFAULT_URL_EXPIRY_SECONDS = 900;
const UUID_FILE_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]+$/i;
const MONGO_ID_PATTERN = /^[a-f\d]{24}$/i;

const normalizeExpiry = (expiresIn) => {
    const value = expiresIn ?? DEFAULT_URL_EXPIRY_SECONDS;

    if (!Number.isInteger(value) || value < 60 || value > 3600) {
        throw new ApiError(
            400,
            "URL expiry must be between 60 and 3600 seconds"
        );
    }

    return value;
};

const safeDownloadName = (name) => {
    const decodedName = (() => {
        try {
            return decodeURIComponent(name || "");
        } catch {
            return "";
        }
    })();

    const asciiName = decodedName
        .replace(/[^\x20-\x7E]/g, "_")
        .replace(/["\\;\r\n]/g, "_")
        .slice(0, 180);

    return asciiName || "download";
};

const throwStorageError = (error, action) => {
    if (error instanceof ApiError) {
        throw error;
    }

    const statusCode = error?.$metadata?.httpStatusCode;
    if (
        error?.name === "NotFound" ||
        error?.name === "NoSuchKey" ||
        statusCode === 404
    ) {
        throw new ApiError(404, "Storage object not found");
    }

    throw new ApiError(502, `Unable to ${action} storage object`);
};

export const assertObjectKeyAccess = (key, user) => {
    try {
        assertValidStorageKey(key);
    } catch (error) {
        throw new ApiError(400, error.message);
    }

    const rootPrefix = `${S3_ROOT_FOLDER}/`;
    if (!key.startsWith(rootPrefix)) {
        throw new ApiError(403, "Storage object is outside the allowed root");
    }

    const parts = key.slice(rootPrefix.length).split("/");
    const [scope, ownerOrFile, folderOrUndefined, fileOrUndefined] = parts;
    let ownerId;
    let fileName;

    if (scope === "users") {
        if (
            parts.length !== 4 ||
            folderOrUndefined !== "avatars" ||
            !MONGO_ID_PATTERN.test(ownerOrFile)
        ) {
            throw new ApiError(400, "Invalid user storage object key");
        }

        ownerId = ownerOrFile;
        fileName = fileOrUndefined;

        if (user.role !== "admin" && String(user.userId) !== ownerId) {
            throw new ApiError(403, "You cannot access this storage object");
        }
    } else if (scope === "projects") {
        if (
            parts.length !== 4 ||
            !MONGO_ID_PATTERN.test(ownerOrFile) ||
            !["images", "videos", "audio", "thumbnails"].includes(
                folderOrUndefined
            )
        ) {
            throw new ApiError(400, "Invalid project storage object key");
        }

        fileName = fileOrUndefined;
    } else if (
        ["templates", "voices", "exports", "temp"].includes(scope)
    ) {
        if (parts.length !== 2) {
            throw new ApiError(400, "Invalid root storage object key");
        }

        fileName = ownerOrFile;
    } else {
        throw new ApiError(400, "Invalid storage object key");
    }

    if (!UUID_FILE_PATTERN.test(fileName)) {
        throw new ApiError(400, "Invalid storage object file name");
    }

    return { ownerId, scope };
};

export const getObjectMetadata = async (key) => {
    try {
        return await s3Client.send(
            new HeadObjectCommand({
                Bucket: S3_BUCKET_NAME,
                Key: key,
            })
        );
    } catch (error) {
        throwStorageError(error, "read");
    }
};

export const assertUploaderAccess = (metadata, user) => {
    const uploadedBy = metadata?.Metadata?.["uploaded-by"];

    if (
        user.role !== "admin" &&
        (!uploadedBy || uploadedBy !== String(user.userId))
    ) {
        throw new ApiError(403, "You cannot access this storage object");
    }
};

export const generatePresignedUploadUrl = async ({
    key,
    mimeType,
    fileSize,
    userId,
    originalFileName,
    expiresIn,
}) => {
    const metadata = {
        "uploaded-by": String(userId),
        "original-name": encodeURIComponent(originalFileName),
    };
    const serverSideEncryption = "AES256";

    try {
        const command = new PutObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: key,
            ContentType: mimeType,
            ContentLength: fileSize,
            ServerSideEncryption: serverSideEncryption,
            Metadata: metadata,
        });

        const uploadUrl = await getSignedUrl(s3Client, command, {
            expiresIn: normalizeExpiry(expiresIn),
            signableHeaders: new Set(["content-type"]),
            unhoistableHeaders: new Set([
                "x-amz-meta-uploaded-by",
                "x-amz-meta-original-name",
            ]),
        });

        return {
            uploadUrl,
            method: "PUT",
            requiredHeaders: {
                "Content-Type": mimeType,
                "Content-Length": String(fileSize),
                "x-amz-server-side-encryption": serverSideEncryption,
                "x-amz-meta-uploaded-by": metadata["uploaded-by"],
                "x-amz-meta-original-name": metadata["original-name"],
            },
        };
    } catch (error) {
        throwStorageError(error, "create an upload URL for");
    }
};

export const generatePresignedDownloadUrl = async ({
    key,
    user,
    expiresIn,
}) => {
    assertObjectKeyAccess(key, user);
    const metadata = await getObjectMetadata(key);
    assertUploaderAccess(metadata, user);

    const downloadName = safeDownloadName(
        metadata.Metadata?.["original-name"]
    );

    try {
        const command = new GetObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: key,
            ResponseContentDisposition: `attachment; filename="${downloadName}"`,
        });

        const downloadUrl = await getSignedUrl(s3Client, command, {
            expiresIn: normalizeExpiry(expiresIn),
        });

        return {
            downloadUrl,
            method: "GET",
            expiresIn: normalizeExpiry(expiresIn),
            contentType: metadata.ContentType,
            contentLength: metadata.ContentLength,
        };
    } catch (error) {
        throwStorageError(error, "create a download URL for");
    }
};
