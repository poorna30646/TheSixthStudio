import mongoose from "mongoose";

export const VIDEO_STATUSES = Object.freeze([
    "draft",
    "queued",
    "processing",
    "completed",
    "failed",
    "cancelled",
]);

const isStorageUrl = (value) => {
    if (value === null || value === undefined || value === "") return true;
    try {
        return ["http:", "https:", "s3:"].includes(new URL(value).protocol);
    } catch {
        return false;
    }
};

const videoSchema = new mongoose.Schema(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true,
            immutable: true,
            index: true,
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            immutable: true,
            index: true,
        },
        status: {
            type: String,
            enum: VIDEO_STATUSES,
            default: "draft",
            index: true,
        },
        timeline: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
        },
        assets: {
            type: [
                {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Asset",
                },
            ],
            required: true,
            validate: {
                validator: (value) =>
                    Array.isArray(value) &&
                    value.length >= 1 &&
                    value.length <= 500,
                message: "Video must reference between 1 and 500 Assets",
            },
        },
        voice: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Voice",
            default: null,
            index: true,
        },
        template: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Template",
            default: null,
            index: true,
        },
        renderProgress: {
            type: Number,
            min: 0,
            max: 100,
            default: 0,
        },
        outputUrl: {
            type: String,
            trim: true,
            default: null,
            validate: {
                validator: isStorageUrl,
                message: "outputUrl must be a valid HTTP, HTTPS, or S3 URL",
            },
        },
        thumbnail: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Asset",
            default: null,
        },
        duration: {
            type: Number,
            min: 0.01,
            max: 86400,
            required: true,
        },
        renderedAt: {
            type: Date,
            default: null,
            index: true,
        },
        deletedAt: {
            type: Date,
            default: null,
            index: true,
        },
    },
    {
        timestamps: true,
        minimize: false,
        versionKey: false,
    }
);

videoSchema.index({ owner: 1, deletedAt: 1, createdAt: -1 });
videoSchema.index({ project: 1, status: 1, createdAt: -1 });

const Video = mongoose.model("Video", videoSchema);

export default Video;
