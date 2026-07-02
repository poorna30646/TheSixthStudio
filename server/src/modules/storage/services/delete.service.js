import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import ApiError from "../../../utils/ApiError.js";
import assetRepository from "../../assets/asset.repository.js";
import projectRepository from "../../projects/project.repository.js";
import templateRepository from "../../templates/template.repository.js";
import videoRepository from "../../videos/video.repository.js";
import s3Client, {
    S3_BUCKET_NAME,
    S3_EXPECTED_BUCKET_OWNER,
} from "../config/s3.config.js";
import {
    assertObjectKeyAccess,
    assertUploaderAccess,
    getObjectMetadata,
} from "./signedUrl.service.js";

export const deleteObject = async ({ key, user }) => {
    assertObjectKeyAccess(key, user);

    const metadata = await getObjectMetadata(key);
    assertUploaderAccess(metadata, user);
    const existingAsset = await assetRepository.findByKey(key);
    if (
        existingAsset &&
        (await videoRepository.hasActiveRenderForAsset(existingAsset._id))
    ) {
        throw new ApiError(
            409,
            "Asset cannot be deleted while a video render is active"
        );
    }

    try {
        await s3Client.send(
            new DeleteObjectCommand({
                Bucket: S3_BUCKET_NAME,
                Key: key,
                ExpectedBucketOwner: S3_EXPECTED_BUCKET_OWNER,
            })
        );
        const asset = await assetRepository.markDeletedByKey(key);
        if (asset?.project) {
            await projectRepository.removeAsset(asset.project, asset._id);
        }
        if (asset) {
            await templateRepository.removeAssetReferences(asset._id);
            await videoRepository.removeAssetReferences(asset._id);
        }

        return { key, deleted: true };
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }

        throw new ApiError(502, "Unable to delete storage object");
    }
};

export default { deleteObject };
