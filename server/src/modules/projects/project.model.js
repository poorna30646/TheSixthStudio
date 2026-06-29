import mongoose from "mongoose";

export const PROJECT_VISIBILITIES = Object.freeze([
    "private",
    "unlisted",
    "public",
]);

export const PROJECT_STATUSES = Object.freeze(["active", "archived"]);

const projectSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 120,
        },
        description: {
            type: String,
            trim: true,
            maxlength: 2000,
            default: "",
        },
        thumbnail: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Asset",
            default: null,
        },
        visibility: {
            type: String,
            enum: PROJECT_VISIBILITIES,
            default: "private",
            index: true,
        },
        status: {
            type: String,
            enum: PROJECT_STATUSES,
            default: "active",
            index: true,
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            immutable: true,
            index: true,
        },
        assets: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Asset",
            },
        ],
        settings: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
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

projectSchema.index({ owner: 1, deletedAt: 1, createdAt: -1 });
projectSchema.index({ owner: 1, status: 1, visibility: 1 });
projectSchema.index({ title: "text", description: "text" });

const Project = mongoose.model("Project", projectSchema);

export default Project;
