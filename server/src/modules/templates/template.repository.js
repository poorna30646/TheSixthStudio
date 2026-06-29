import Template from "./template.model.js";
import ApiError from "../../utils/ApiError.js";

const SORT_FIELDS = new Set([
    "createdAt",
    "updatedAt",
    "title",
    "category",
    "status",
]);

const escapeRegex = (value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

class TemplateRepository {
    constructor(model) {
        this.model = model;
    }

    async create(data) {
        try {
            return await this.model.create(data);
        } catch (error) {
            throw new ApiError(422, `Unable to create template: ${error.message}`);
        }
    }

    async findAccessibleById(
        templateId,
        user,
        { includeDeleted = false } = {}
    ) {
        const query = { _id: templateId };
        if (user.role !== "admin") query.owner = user.userId;
        if (!includeDeleted) query.deletedAt = null;
        return this.model.findOne(query);
    }

    async list(user, options) {
        const {
            page = 1,
            limit = 20,
            search,
            category,
            status,
            isPublic,
            tag,
            owner,
            sortBy = "createdAt",
            sortOrder = "desc",
        } = options;

        const query = { deletedAt: null };
        if (user.role !== "admin") query.owner = user.userId;
        else if (owner) query.owner = owner;
        if (category) query.category = category;
        if (status) query.status = status;
        if (isPublic !== undefined) query.isPublic = isPublic;
        if (tag) query.tags = tag;

        if (search) {
            const pattern = escapeRegex(search.trim());
            query.$or = [
                { title: { $regex: pattern, $options: "i" } },
                { description: { $regex: pattern, $options: "i" } },
                { tags: { $regex: pattern, $options: "i" } },
            ];
        }

        const safeSortBy = SORT_FIELDS.has(sortBy) ? sortBy : "createdAt";
        const direction = sortOrder === "asc" ? 1 : -1;
        const skip = (page - 1) * limit;

        const [templates, total] = await Promise.all([
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
            templates,
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

    async updateById(templateId, changes) {
        try {
            return await this.model.findByIdAndUpdate(
                templateId,
                { $set: changes },
                { new: true, runValidators: true }
            );
        } catch (error) {
            throw new ApiError(422, `Unable to update template: ${error.message}`);
        }
    }

    async softDelete(templateId) {
        return this.updateById(templateId, {
            status: "archived",
            isPublic: false,
            deletedAt: new Date(),
        });
    }

    async removeAssetReferences(assetId) {
        await this.model.updateMany(
            { assets: assetId, "assets.1": { $exists: true } },
            {
                $pull: { assets: assetId },
                $set: { updatedAt: new Date() },
            }
        );
        await this.model.updateMany(
            { thumbnail: assetId },
            { $set: { thumbnail: null, updatedAt: new Date() } }
        );
        await this.model.updateMany(
            { assets: assetId, "assets.1": { $exists: false } },
            {
                $set: {
                    status: "archived",
                    isPublic: false,
                    deletedAt: new Date(),
                    updatedAt: new Date(),
                },
            }
        );
    }
}

export default new TemplateRepository(Template);
