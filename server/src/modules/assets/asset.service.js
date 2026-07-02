import ApiError from "../../utils/ApiError.js";
import { S3_BUCKET_NAME } from "../storage/config/s3.config.js";
import { deleteObject } from "../storage/services/delete.service.js";
import {
    assertObjectKeyAccess,
    assertUploaderAccess,
    getObjectMetadata,
} from "../storage/services/signedUrl.service.js";
import assetRepository from "./asset.repository.js";
import projectRepository from "../projects/project.repository.js";
import { assertProjectOwnership } from "../projects/project.service.js";
import templateRepository from "../templates/template.repository.js";
import videoRepository from "../videos/video.repository.js";

const typeFromMimeType = (mimeType) => {
    const [group] = String(mimeType).toLowerCase().split("/");
    if (["image", "video", "audio"].includes(group)) return group;
    if (
        ["application/zip", "application/x-zip-compressed"].includes(mimeType)
    ) {
        return "archive";
    }
    if (["application/json", "application/pdf"].includes(mimeType)) {
        return "document";
    }
    return "other";
};

const storageUrl = (key) => `s3://${S3_BUCKET_NAME}/${key}`;

const originalNameFromMetadata = (metadata, fallback) => {
    try {
        return decodeURIComponent(
            metadata?.Metadata?.["original-name"] || fallback
        );
    } catch {
        return fallback;
    }
};

export const assertUploadedObjectMatchesPendingAsset = (
    objectMetadata,
    pendingAsset,
    user
) => {
    assertUploaderAccess(objectMetadata, user, { allowAdmin: false });

    const mimeType = objectMetadata.ContentType?.toLowerCase();
    if (
        objectMetadata.ContentLength !== pendingAsset.size ||
        mimeType !== pendingAsset.mimeType
    ) {
        throw new ApiError(
            422,
            "Uploaded object does not match the reserved size and MIME type"
        );
    }

    if (objectMetadata.ServerSideEncryption !== "AES256") {
        throw new ApiError(
            422,
            "Uploaded object does not use the required server-side encryption"
        );
    }

    const expectedOriginalName = pendingAsset.metadata?.originalName;
    const uploadedOriginalName = originalNameFromMetadata(objectMetadata);
    if (
        !expectedOriginalName ||
        uploadedOriginalName !== expectedOriginalName
    ) {
        throw new ApiError(
            422,
            "Uploaded object does not match the reserved original file name"
        );
    }
};

const getAssetOrThrow = async (assetId, user) => {
    const asset = await assetRepository.findAccessibleById(assetId, user);
    if (!asset) throw new ApiError(404, "Asset not found");
    return asset;
};

const attachAssetToProject = async (asset) => {
    if (!asset.project) return asset;
    try {
        await projectRepository.addAsset(asset.project, asset._id);
        return asset;
    } catch (error) {
        await assetRepository.hardDeleteById(asset._id);
        throw error;
    }
};

export const createPendingAsset = async ({
    userId,
    projectId,
    category,
    key,
    mimeType,
    extension,
    size,
    originalName,
}) => {
    const asset = await assetRepository.create({
        user: userId,
        project: projectId || null,
        type: typeFromMimeType(mimeType),
        category,
        key,
        url: storageUrl(key),
        mimeType,
        extension,
        size,
        status: "pending",
        metadata: { originalName },
        isPublic: false,
    });
    return attachAssetToProject(asset);
};

export const createAsset = async ({ key, metadata = {}, isPublic, user }) => {
    const keyDetails = assertObjectKeyAccess(key, user);

    if (keyDetails.projectId) {
        await assertProjectOwnership(keyDetails.projectId, user);
    }

    const pendingAsset = await assetRepository.findPendingByKeyForUser(
        key,
        user.userId
    );
    if (!pendingAsset) {
        throw new ApiError(404, "Pending asset not found");
    }

    const objectMetadata = await getObjectMetadata(key);
    assertUploadedObjectMatchesPendingAsset(
        objectMetadata,
        pendingAsset,
        user
    );

    const asset = await assetRepository.finalizePendingByKey(
        key,
        user.userId,
        {
            metadata: {
                ...pendingAsset.metadata,
                ...metadata,
                originalName: originalNameFromMetadata(
                    objectMetadata,
                    pendingAsset.metadata?.originalName || key
                ),
            },
            isPublic: isPublic ?? false,
        }
    );

    if (!asset) {
        throw new ApiError(409, "Asset is no longer pending");
    }

    return asset;
};

export const listAssets = (user, filters) =>
    assetRepository.list(user, filters);

export const getAsset = (assetId, user) =>
    getAssetOrThrow(assetId, user);

export const updateAsset = async (assetId, changes, user) => {
    const asset = await getAssetOrThrow(assetId, user);
    const update = {};

    if (changes.metadata !== undefined) {
        update.metadata = { ...asset.metadata, ...changes.metadata };
    }
    if (changes.isPublic !== undefined) update.isPublic = changes.isPublic;

    return assetRepository.updateById(asset._id, update);
};

export const deleteAsset = async (assetId, user) => {
    const asset = await getAssetOrThrow(assetId, user);

    try {
        await deleteObject({ key: asset.key, user });
    } catch (error) {
        if (error.statusCode !== 404) throw error;
    }

    const deletedAsset = await assetRepository.markDeletedById(asset._id);
    if (asset.project) {
        await projectRepository.removeAsset(asset.project, asset._id);
    }
    await templateRepository.removeAssetReferences(asset._id);
    await videoRepository.removeAssetReferences(asset._id);
    return deletedAsset;
};

export default {
    createAsset,
    createPendingAsset,
    listAssets,
    getAsset,
    updateAsset,
    deleteAsset,
};
