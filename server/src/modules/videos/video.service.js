import ApiError from "../../utils/ApiError.js";
import assetRepository from "../assets/asset.repository.js";
import { assertProjectOwnership } from "../projects/project.service.js";
import templateRepository from "../templates/template.repository.js";
import voiceRepository from "../voices/voice.repository.js";
import { enqueueVideoRender } from "./video.queue.js";
import videoRepository from "./video.repository.js";

const uniqueIds = (ids) => [...new Set(ids.map(String))];

const getVideoOrThrow = async (videoId, user) => {
    const video = await videoRepository.findAccessibleById(videoId, user);
    if (!video) throw new ApiError(404, "Video not found");
    return video;
};

const verifyReferences = async ({
    projectId,
    assetIds,
    thumbnailId,
    voiceId,
    templateId,
    user,
}) => {
    await assertProjectOwnership(projectId, user);

    const ids = uniqueIds(assetIds);
    const assets = await assetRepository.findAccessibleByIds(ids, user);
    if (assets.length !== ids.length) {
        throw new ApiError(
            422,
            "Every Asset must exist and belong to the video owner"
        );
    }
    if (
        assets.some(
            (asset) =>
                asset.status !== "ready" ||
                String(asset.project) !== String(projectId)
        )
    ) {
        throw new ApiError(
            422,
            "Every Asset must be ready and belong to the selected Project"
        );
    }

    if (thumbnailId) {
        if (!ids.includes(String(thumbnailId))) {
            throw new ApiError(
                422,
                "Thumbnail must be included in the video assets"
            );
        }
        const thumbnail = assets.find(
            (asset) => String(asset._id) === String(thumbnailId)
        );
        if (thumbnail?.type !== "image") {
            throw new ApiError(422, "Thumbnail Asset must be an image");
        }
    }

    if (voiceId) {
        const voice = await voiceRepository.findById(voiceId);
        if (!voice || voice.status !== "active") {
            throw new ApiError(422, "Voice must reference an active Voice");
        }
    }

    if (templateId) {
        const template = await templateRepository.findAccessibleById(
            templateId,
            user
        );
        if (!template || template.status === "archived") {
            throw new ApiError(
                422,
                "Template must reference an accessible active Template"
            );
        }
    }

    return ids;
};

export const createVideo = async ({ data, user }) => {
    const assets = await verifyReferences({
        projectId: data.project,
        assetIds: data.assets,
        thumbnailId: data.thumbnail,
        voiceId: data.voice,
        templateId: data.template,
        user,
    });

    return videoRepository.create({
        project: data.project,
        owner: user.userId,
        status: "draft",
        timeline: data.timeline,
        assets,
        voice: data.voice || null,
        template: data.template || null,
        renderProgress: 0,
        outputUrl: null,
        thumbnail: data.thumbnail || null,
        duration: data.duration,
    });
};

export const listVideos = (user, filters) =>
    videoRepository.list(user, filters);

export const getVideo = (videoId, user) =>
    getVideoOrThrow(videoId, user);

export const updateVideo = async (videoId, changes, user) => {
    const video = await getVideoOrThrow(videoId, user);
    if (["queued", "processing"].includes(video.status)) {
        throw new ApiError(409, "A queued or processing video cannot be edited");
    }

    const assets = changes.assets || video.assets;
    const thumbnail =
        changes.thumbnail !== undefined ? changes.thumbnail : video.thumbnail;
    const voice = changes.voice !== undefined ? changes.voice : video.voice;
    const template =
        changes.template !== undefined ? changes.template : video.template;

    if (
        changes.assets !== undefined ||
        changes.thumbnail !== undefined ||
        changes.voice !== undefined ||
        changes.template !== undefined
    ) {
        await verifyReferences({
            projectId: video.project,
            assetIds: assets,
            thumbnailId: thumbnail,
            voiceId: voice,
            templateId: template,
            user,
        });
    }

    const update = {
        status: "draft",
        renderProgress: 0,
        outputUrl: null,
    };
    for (const field of [
        "timeline",
        "assets",
        "voice",
        "template",
        "thumbnail",
        "duration",
    ]) {
        if (changes[field] !== undefined) {
            update[field] =
                field === "assets" ? uniqueIds(changes[field]) : changes[field];
        }
    }

    return videoRepository.updateById(video._id, update);
};

export const deleteVideo = async (videoId, user) => {
    const video = await getVideoOrThrow(videoId, user);
    if (["queued", "processing"].includes(video.status)) {
        throw new ApiError(409, "A queued or processing video cannot be deleted");
    }
    await videoRepository.softDelete(video._id);
    return { videoId: video._id, deleted: true };
};

export const queueVideoRender = async (videoId, user) => {
    const video = await getVideoOrThrow(videoId, user);
    if (!["draft", "failed", "completed", "cancelled"].includes(video.status)) {
        throw new ApiError(409, "Video is already queued or processing");
    }

    await verifyReferences({
        projectId: video.project,
        assetIds: video.assets,
        thumbnailId: video.thumbnail,
        voiceId: video.voice,
        templateId: video.template,
        user,
    });

    const previousStatus = video.status;
    await videoRepository.updateById(video._id, {
        status: "queued",
        renderProgress: 0,
        outputUrl: null,
    });

    try {
        const job = await enqueueVideoRender({
            videoId: String(video._id),
            projectId: String(video.project),
            ownerId: String(video.owner),
            requestedAt: new Date().toISOString(),
        });
        return {
            videoId: video._id,
            jobId: job.id,
            queueName: job.queueName,
            status: "queued",
        };
    } catch (error) {
        await videoRepository.updateById(video._id, {
            status: previousStatus,
            renderProgress: video.renderProgress,
            outputUrl: video.outputUrl,
        });
        throw error;
    }
};

export const markVideoProcessing = async (videoId) => {
    const video = await videoRepository.updateByIdAndStatus(
        videoId,
        ["queued"],
        { status: "processing", renderProgress: 0 }
    );
    if (!video) throw new ApiError(409, "Video is not queued");
    return video;
};

export const updateVideoRenderProgress = async (videoId, progress) => {
    if (!Number.isFinite(progress) || progress < 0 || progress > 99) {
        throw new ApiError(422, "Render progress must be between 0 and 99");
    }
    const video = await videoRepository.updateByIdAndStatus(
        videoId,
        ["queued", "processing"],
        { status: "processing", renderProgress: progress }
    );
    if (!video) throw new ApiError(409, "Video is not rendering");
    return video;
};

export const completeVideoRender = async (
    videoId,
    { outputUrl, thumbnail, duration }
) => {
    const video = await videoRepository.updateByIdAndStatus(
        videoId,
        ["queued", "processing"],
        {
            status: "completed",
            renderProgress: 100,
            outputUrl,
            renderedAt: new Date(),
            ...(thumbnail !== undefined ? { thumbnail } : {}),
            ...(duration !== undefined ? { duration } : {}),
        }
    );
    if (!video) throw new ApiError(409, "Video is not rendering");
    return video;
};

export const failVideoRender = async (videoId) => {
    const video = await videoRepository.updateByIdAndStatus(
        videoId,
        ["queued", "processing"],
        { status: "failed" }
    );
    if (!video) throw new ApiError(409, "Video is not rendering");
    return video;
};

export default {
    createVideo,
    listVideos,
    getVideo,
    updateVideo,
    deleteVideo,
    queueVideoRender,
    markVideoProcessing,
    updateVideoRenderProgress,
    completeVideoRender,
    failVideoRender,
};
