import ApiResponse from "../../../utils/ApiResponse.js";
import asyncHandler from "../../../middleware/asyncHandler.js";
import { createUploadUrl } from "../services/upload.service.js";
import { deleteObject } from "../services/delete.service.js";
import { generatePresignedDownloadUrl } from "../services/signedUrl.service.js";

export const getUploadUrl = asyncHandler(async (req, res) => {
    const result = await createUploadUrl({
        ...req.body,
        user: req.user,
    });

    res.status(200).json(
        new ApiResponse(200, "Upload URL generated successfully", result)
    );
});

export const getDownloadUrl = asyncHandler(async (req, res) => {
    const result = await generatePresignedDownloadUrl({
        key: req.body.key,
        expiresIn: req.body.expiresIn,
        user: req.user,
    });

    res.status(200).json(
        new ApiResponse(200, "Download URL generated successfully", result)
    );
});

export const removeObject = asyncHandler(async (req, res) => {
    const result = await deleteObject({
        key: req.body.key,
        user: req.user,
    });

    res.status(200).json(
        new ApiResponse(200, "Storage object deleted successfully", result)
    );
});
