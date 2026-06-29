import { Queue } from "bullmq";
import ApiError from "../../utils/ApiError.js";
import env from "../../config/env.js";

export const VIDEO_RENDER_QUEUE = "video-render";

let renderQueue;

const getConnection = () => {
    if (!env.REDIS_URL) {
        throw new ApiError(
            503,
            "Video rendering is unavailable because REDIS_URL is not configured"
        );
    }

    let url;
    try {
        url = new URL(env.REDIS_URL);
    } catch {
        throw new ApiError(500, "REDIS_URL is invalid");
    }

    if (!["redis:", "rediss:"].includes(url.protocol)) {
        throw new ApiError(500, "REDIS_URL must use redis:// or rediss://");
    }

    const database = url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0;
    if (!Number.isInteger(database) || database < 0) {
        throw new ApiError(500, "REDIS_URL contains an invalid database number");
    }

    return {
        host: url.hostname,
        port: Number(url.port || 6379),
        username: url.username ? decodeURIComponent(url.username) : undefined,
        password: url.password ? decodeURIComponent(url.password) : undefined,
        db: database,
        ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    };
};

const getQueue = () => {
    if (!renderQueue) {
        renderQueue = new Queue(VIDEO_RENDER_QUEUE, {
            connection: getConnection(),
            defaultJobOptions: {
                attempts: 3,
                backoff: { type: "exponential", delay: 5000 },
                removeOnComplete: { age: 86400, count: 1000 },
                removeOnFail: { age: 604800, count: 5000 },
            },
        });
    }
    return renderQueue;
};

export const enqueueVideoRender = async (payload) => {
    try {
        const queue = getQueue();
        return await queue.add("render", payload, {
            jobId: `${payload.videoId}-${Date.now()}`,
        });
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(503, "Unable to enqueue video render");
    }
};

export const closeVideoRenderQueue = async () => {
    if (renderQueue) {
        await renderQueue.close();
        renderQueue = undefined;
    }
};
