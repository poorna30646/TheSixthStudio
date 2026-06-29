import Asset from "./asset.model.js";
import ApiError from "../../utils/ApiError.js";

const SORT_FIELDS = new Set([
    "createdAt",
    "updatedAt",
    "size",
    "type",
    "category",
    "status",
    "mimeType",
]);

const escapeRegex = (value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

class AssetRepository {
    constructor(model) {
        this.model = model;
    }

    async create(data, session = null) {
        try {
            const [asset] = await this.model.create([data], { session });
            return asset;
        } catch (error) {
            if (error.code === 11000) {
                throw new ApiError(409, "An asset already exists for this key");
            }
            if (error instanceof ApiError) throw error;
            throw new ApiError(422, `Unable to create asset: ${error.message}`);
        }
    }

    async findByKey(key, { includeDeleted = false } = {}) {
        const filter = { key };
        if (!includeDeleted) filter.status = { $ne: "deleted" };
        return this.model.findOne(filter);
    }

    async findAccessibleById(assetId, user) {
        const filter = { _id: assetId, status: { $ne: "deleted" } };
        if (user.role !== "admin") filter.user = user.userId;
        return this.model.findOne(filter);
    }

    async findAccessibleByIds(assetIds, user) {
        const filter = {
            _id: { $in: assetIds },
            status: { $ne: "deleted" },
        };
        if (user.role !== "admin") filter.user = user.userId;
        return this.model.find(filter);
    }

    async list(user, options) {
        const {
            page = 1,
            limit = 20,
            search,
            sortBy = "createdAt",
            sortOrder = "desc",
            ...filters
        } = options;

        const query = { status: { $ne: "deleted" } };
        if (user.role !== "admin") {
            query.user = user.userId;
        } else if (filters.user) {
            query.user = filters.user;
        }

        for (const field of [
            "project",
            "type",
            "category",
            "status",
            "mimeType",
            "extension",
            "isPublic",
        ]) {
            if (filters[field] !== undefined) query[field] = filters[field];
        }

        if (search) {
            const pattern = escapeRegex(search.trim());
            query.$or = [
                { key: { $regex: pattern, $options: "i" } },
                { mimeType: { $regex: pattern, $options: "i" } },
                { extension: { $regex: pattern, $options: "i" } },
                {
                    "metadata.originalName": {
                        $regex: pattern,
                        $options: "i",
                    },
                },
            ];
        }

        const safeSortBy = SORT_FIELDS.has(sortBy) ? sortBy : "createdAt";
        const sort = {
            [safeSortBy]: sortOrder === "asc" ? 1 : -1,
            _id: sortOrder === "asc" ? 1 : -1,
        };
        const skip = (page - 1) * limit;

        const [assets, total] = await Promise.all([
            this.model.find(query).sort(sort).skip(skip).limit(limit).lean(),
            this.model.countDocuments(query),
        ]);

        const totalPages = Math.ceil(total / limit);
        return {
            assets,
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

    async updateById(assetId, data) {
        try {
            return await this.model.findByIdAndUpdate(
                assetId,
                { $set: data },
                { new: true, runValidators: true }
            );
        } catch (error) {
            throw new ApiError(422, `Unable to update asset: ${error.message}`);
        }
    }

    async markDeletedById(assetId) {
        return this.updateById(assetId, {
            status: "deleted",
            isPublic: false,
        });
    }

    async markDeletedByKey(key) {
        return this.model.findOneAndUpdate(
            { key, status: { $ne: "deleted" } },
            { $set: { status: "deleted", isPublic: false } },
            { new: true }
        );
    }

    async hardDeleteById(assetId) {
        return this.model.findByIdAndDelete(assetId);
    }
}

export default new AssetRepository(Asset);
