import ApiResponse from "../../utils/ApiResponse.js";
import asyncHandler from "../../middleware/asyncHandler.js";
import {
    createVideo,
    deleteVideo,
    getVideo,
    listVideos,
    queueVideoRender,
    updateVideo,
} from "./video.service.js";

export const create = asyncHandler(async (req, res) => {
    const video = await createVideo({ data: req.body, user: req.user });
    res.status(201).json(
        new ApiResponse(201, "Video created successfully", { video })
    );
});

export const list = asyncHandler(async (req, res) => {
    const result = await listVideos(req.user, req.query);
    res.status(200).json(
        new ApiResponse(200, "Videos retrieved successfully", result)
    );
});

export const getById = asyncHandler(async (req, res) => {
    const video = await getVideo(req.params.videoId, req.user);
    res.status(200).json(
        new ApiResponse(200, "Video retrieved successfully", { video })
    );
});

export const update = asyncHandler(async (req, res) => {
    const video = await updateVideo(
        req.params.videoId,
        req.body,
        req.user
    );
    res.status(200).json(
        new ApiResponse(200, "Video updated successfully", { video })
    );
});

export const remove = asyncHandler(async (req, res) => {
    const result = await deleteVideo(req.params.videoId, req.user);
    res.status(200).json(
        new ApiResponse(200, "Video deleted successfully", result)
    );
});

export const render = asyncHandler(async (req, res) => {
    const result = await queueVideoRender(req.params.videoId, req.user);
    res.status(202).json(
        new ApiResponse(202, "Video render queued successfully", result)
    );
});
