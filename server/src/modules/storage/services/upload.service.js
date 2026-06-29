import { v4 as uuidv4 } from "uuid";
import ApiError from "../../../utils/ApiError.js";
import { S3_ROOT_FOLDER } from "../config/s3.config.js";
import {
    assertValidUploadMetadata,
} from "../validators/storage.validation.js";
import { generatePresignedUploadUrl } from "./signedUrl.service.js";

const buildObjectKey = ({ folder, projectId, userId, extension, scope }) => {
    const fileName = `${uuidv4()}.${extension}`;

    if (scope === "user") {
        return `${S3_ROOT_FOLDER}/users/${userId}/avatars/${fileName}`;
    }

    if (scope === "project") {
        return `${S3_ROOT_FOLDER}/projects/${projectId}/${folder}/${fileName}`;
    }

    return `${S3_ROOT_FOLDER}/${folder}/${fileName}`;
};

export const createUploadUrl = async ({
    fileName,
    mimeType,
    fileSize,
    folder,
    projectId,
    expiresIn,
    userId,
}) => {
    let validated;

    try {
        validated = assertValidUploadMetadata({
            fileName,
            mimeType,
            fileSize,
            folder,
            projectId,
        });
    } catch (error) {
        throw new ApiError(422, error.message);
    }

    const key = buildObjectKey({
        folder,
        projectId,
        userId,
        extension: validated.extension,
        scope: validated.policy.scope,
    });

    const signedUpload = await generatePresignedUploadUrl({
        key,
        mimeType: validated.mimeType,
        fileSize: validated.fileSize,
        userId,
        originalFileName: fileName,
        expiresIn,
    });

    return {
        ...signedUpload,
        key,
        fileName: key.split("/").at(-1),
        originalFileName: fileName,
        mimeType: validated.mimeType,
        fileSize: validated.fileSize,
        expiresIn: expiresIn ?? 900,
    };
};

export default { createUploadUrl };
