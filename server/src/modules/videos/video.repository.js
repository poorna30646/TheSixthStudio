import Video from "./video.model.js";
import ApiError from "../../utils/ApiError.js";

const SORT_FIELDS = new Set([
    "createdAt",
    "updatedAt",
    "status",
    "renderProgress",
    "duration",
]);

class VideoRepository {
    constructor(model) {
        this.model = model;
    }

    async create(data) {
        try {
            return await this.model.create(data);
        } catch (error) {
            throw new ApiError(422, `Unable to create video: ${error.message}`);
        }
    }

    async findAccessibleById(videoId, user) {
        const query = { _id: videoId, deletedAt: null };
        if (user.role !== "admin") query.owner = user.userId;
        return this.model.findOne(query);
    }

    async findById(videoId) {
        return this.model.findOne({ _id: videoId, deletedAt: null });
    }

    async list(user, options) {
        const {
            page = 1,
            limit = 20,
            project,
            status,
            voice,
            template,
            minDuration,
            maxDuration,
            owner,
            sortBy = "createdAt",
            sortOrder = "desc",
        } = options;

        const query = { deletedAt: null };
        if (user.role !== "admin") query.owner = user.userId;
        else if (owner) query.owner = owner;
        if (project) query.project = project;
        if (status) query.status = status;
        if (voice) query.voice = voice;
        if (template) query.template = template;
        if (minDuration !== undefined || maxDuration !== undefined) {
            query.duration = {};
            if (minDuration !== undefined) query.duration.$gte = minDuration;
            if (maxDuration !== undefined) query.duration.$lte = maxDuration;
        }

        const safeSortBy = SORT_FIELDS.has(sortBy) ? sortBy : "createdAt";
        const direction = sortOrder === "asc" ? 1 : -1;
        const skip = (page - 1) * limit;
        const [videos, total] = await Promise.all([
            this.model
                .find(query)
                .sort({ [safeSortBy]: direction, _id: direction })
                .skip(skip)
                .limit(limit)
                .lean(),
            this.model.countDocuments(query),
        ]);

        const totalPages = Math.ceil(total / limit);
        return {
            videos,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
            },
        };
    }

    async updateById(videoId, changes) {
        try {
            return await this.model.findByIdAndUpdate(
                videoId,
                { $set: changes },
                { new: true, runValidators: true }
            );
        } catch (error) {
            throw new ApiError(422, `Unable to update video: ${error.message}`);
        }
    }

    async updateByIdAndStatus(videoId, statuses, changes) {
        return this.model.findOneAndUpdate(
            {
                _id: videoId,
                deletedAt: null,
                status: { $in: statuses },
            },
            { $set: changes },
            { new: true, runValidators: true }
        );
    }

    async softDelete(videoId) {
        return this.updateById(videoId, {
            status: "cancelled",
            deletedAt: new Date(),
        });
    }

    async hasActiveRenderForAsset(assetId) {
        return Boolean(
            await this.model.exists({
                assets: assetId,
                deletedAt: null,
                status: { $in: ["queued", "processing"] },
            })
        );
    }

    async removeAssetReferences(assetId) {
        const now = new Date();
        await this.model.updateMany(
            {
                assets: assetId,
                "assets.1": { $exists: true },
                deletedAt: null,
            },
            {
                $pull: { assets: assetId },
                $set: {
                    status: "draft",
                    renderProgress: 0,
                    outputUrl: null,
                    updatedAt: now,
                },
            }
        );
        await this.model.updateMany(
            { thumbnail: assetId, deletedAt: null },
            { $set: { thumbnail: null, updatedAt: now } }
        );
        await this.model.updateMany(
            {
                assets: assetId,
                "assets.1": { $exists: false },
                deletedAt: null,
            },
            {
                $set: {
                    status: "cancelled",
                    deletedAt: now,
                    updatedAt: now,
                },
            }
        );
    }
}

export default new VideoRepository(Video);
