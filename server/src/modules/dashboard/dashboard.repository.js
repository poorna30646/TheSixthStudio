import mongoose from "mongoose";
import User from "../auth/auth.model.js";
import Project from "../projects/project.model.js";
import Asset from "../assets/asset.model.js";
import Video from "../videos/video.model.js";

const objectId = (value) => new mongoose.Types.ObjectId(value);

const dailyCount = async (model, match, dateField = "createdAt") =>
    model.aggregate([
        { $match: match },
        {
            $group: {
                _id: {
                    $dateToString: {
                        format: "%Y-%m-%d",
                        date: `$${dateField}`,
                        timezone: "UTC",
                    },
                },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

class DashboardRepository {
    async getUserStorageLimit(userId) {
        return User.findById(userId).select("storageLimit").lean();
    }

    async getProjectCount(userId) {
        return Project.countDocuments({
            owner: userId,
            deletedAt: null,
        });
    }

    async getStorageSummary(userId) {
        const [summary] = await Asset.aggregate([
            {
                $match: {
                    user: objectId(userId),
                    status: "ready",
                },
            },
            {
                $group: {
                    _id: null,
                    storageUsed: { $sum: "$size" },
                    assetCount: { $sum: 1 },
                },
            },
        ]);

        return summary || { storageUsed: 0, assetCount: 0 };
    }

    async getRenderedVideoCount(userId) {
        return Video.countDocuments({
            owner: userId,
            status: "completed",
            deletedAt: null,
        });
    }

    async getTemplatesUsedCount(userId) {
        const templateIds = await Video.distinct("template", {
            owner: userId,
            template: { $ne: null },
            deletedAt: null,
        });
        return templateIds.length;
    }

    async getRecentProjects(userId, limit) {
        return Project.find({ owner: userId, deletedAt: null })
            .select(
                "title description thumbnail visibility status createdAt updatedAt"
            )
            .sort({ updatedAt: -1, _id: -1 })
            .limit(limit)
            .lean();
    }

    async getRecentAssets(userId, limit) {
        return Asset.find({ user: userId, status: { $ne: "deleted" } })
            .select(
                "project type category url mimeType extension size status metadata isPublic createdAt updatedAt"
            )
            .sort({ createdAt: -1, _id: -1 })
            .limit(limit)
            .lean();
    }

    async getRecentVideos(userId, limit) {
        return Video.find({ owner: userId, deletedAt: null })
            .select(
                "project status renderProgress outputUrl thumbnail duration renderedAt createdAt updatedAt"
            )
            .sort({ updatedAt: -1, _id: -1 })
            .limit(limit)
            .lean();
    }

    async getProjectActivity(userId, startDate) {
        return dailyCount(Project, {
            owner: objectId(userId),
            deletedAt: null,
            createdAt: { $gte: startDate },
        });
    }

    async getAssetActivity(userId, startDate) {
        return dailyCount(Asset, {
            user: objectId(userId),
            status: { $ne: "deleted" },
            createdAt: { $gte: startDate },
        });
    }

    async getRenderedVideoActivity(userId, startDate) {
        return Video.aggregate([
            {
                $match: {
                    owner: objectId(userId),
                    status: "completed",
                    deletedAt: null,
                    $expr: {
                        $gte: [
                            { $ifNull: ["$renderedAt", "$updatedAt"] },
                            startDate,
                        ],
                    },
                },
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            date: { $ifNull: ["$renderedAt", "$updatedAt"] },
                            timezone: "UTC",
                        },
                    },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);
    }

    async getStorageByType(userId) {
        return Asset.aggregate([
            {
                $match: {
                    user: objectId(userId),
                    status: "ready",
                },
            },
            {
                $group: {
                    _id: "$type",
                    bytes: { $sum: "$size" },
                    count: { $sum: 1 },
                },
            },
            { $project: { _id: 0, type: "$_id", bytes: 1, count: 1 } },
            { $sort: { bytes: -1 } },
        ]);
    }

    async getVideosByStatus(userId) {
        return Video.aggregate([
            {
                $match: {
                    owner: objectId(userId),
                    deletedAt: null,
                },
            },
            { $group: { _id: "$status", count: { $sum: 1 } } },
            { $project: { _id: 0, status: "$_id", count: 1 } },
            { $sort: { count: -1 } },
        ]);
    }

    async getTemplateUsage(userId) {
        return Video.aggregate([
            {
                $match: {
                    owner: objectId(userId),
                    template: { $ne: null },
                    deletedAt: null,
                },
            },
            { $group: { _id: "$template", uses: { $sum: 1 } } },
            {
                $lookup: {
                    from: "templates",
                    localField: "_id",
                    foreignField: "_id",
                    as: "template",
                },
            },
            {
                $project: {
                    _id: 0,
                    templateId: "$_id",
                    title: {
                        $ifNull: [
                            { $arrayElemAt: ["$template.title", 0] },
                            "Deleted template",
                        ],
                    },
                    uses: 1,
                },
            },
            { $sort: { uses: -1 } },
            { $limit: 10 },
        ]);
    }
}

export default new DashboardRepository();
