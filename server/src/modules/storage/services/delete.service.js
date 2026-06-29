import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import ApiError from "../../../utils/ApiError.js";
import assetRepository from "../../assets/asset.repository.js";
import projectRepository from "../../projects/project.repository.js";
import s3Client, { S3_BUCKET_NAME } from "../config/s3.config.js";
import {
    assertObjectKeyAccess,
    assertUploaderAccess,
    getObjectMetadata,
} from "./signedUrl.service.js";

export const deleteObject = async ({ key, user }) => {
    assertObjectKeyAccess(key, user);

    const metadata = await getObjectMetadata(key);
    assertUploaderAccess(metadata, user);

    try {
        await s3Client.send(
            new DeleteObjectCommand({
                Bucket: S3_BUCKET_NAME,
                Key: key,
            })
        );
        const asset = await assetRepository.markDeletedByKey(key);
        if (asset?.project) {
            await projectRepository.removeAsset(asset.project, asset._id);
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
