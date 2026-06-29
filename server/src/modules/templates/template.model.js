import mongoose from "mongoose";

export const TEMPLATE_STATUSES = Object.freeze([
    "draft",
    "published",
    "archived",
]);

const templateSchema = new mongoose.Schema(
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
        category: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            minlength: 2,
            maxlength: 50,
            match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
            index: true,
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            immutable: true,
            index: true,
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
                    value.length <= 100,
                message: "A template must reference between 1 and 100 Assets",
            },
        },
        thumbnail: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Asset",
            default: null,
        },
        status: {
            type: String,
            enum: TEMPLATE_STATUSES,
            default: "draft",
            index: true,
        },
        isPublic: {
            type: Boolean,
            default: false,
            index: true,
        },
        tags: {
            type: [
                {
                    type: String,
                    trim: true,
                    lowercase: true,
                    maxlength: 30,
                },
            ],
            default: [],
        },
        metadata: {
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

templateSchema.index({ owner: 1, deletedAt: 1, createdAt: -1 });
templateSchema.index({ owner: 1, category: 1, status: 1 });
templateSchema.index({ tags: 1 });
templateSchema.index({ title: "text", description: "text", tags: "text" });

const Template = mongoose.model("Template", templateSchema);

export default Template;
