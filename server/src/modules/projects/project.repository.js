import Project from "./project.model.js";
import ApiError from "../../utils/ApiError.js";

const SORT_FIELDS = new Set([
    "createdAt",
    "updatedAt",
    "title",
    "status",
    "visibility",
]);

const escapeRegex = (value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

class ProjectRepository {
    constructor(model) {
        this.model = model;
    }

    async create(data, session = null) {
        try {
            const [project] = await this.model.create([data], { session });
            return project;
        } catch (error) {
            throw new ApiError(422, `Unable to create project: ${error.message}`);
        }
    }

    async findAccessibleById(
        projectId,
        user,
        { includeDeleted = false } = {}
    ) {
        const query = { _id: projectId };
        if (user.role !== "admin") query.owner = user.userId;
        if (!includeDeleted) query.deletedAt = null;
        return this.model.findOne(query);
    }

    async list(user, options) {
        const {
            page = 1,
            limit = 20,
            search,
            visibility,
            status,
            owner,
            includeDeleted = false,
            sortBy = "createdAt",
            sortOrder = "desc",
        } = options;

        const query = {};
        if (user.role !== "admin") query.owner = user.userId;
        else if (owner) query.owner = owner;
        if (!includeDeleted) query.deletedAt = null;
        if (visibility) query.visibility = visibility;
        if (status) query.status = status;

        if (search) {
            const pattern = escapeRegex(search.trim());
            query.$or = [
                { title: { $regex: pattern, $options: "i" } },
                { description: { $regex: pattern, $options: "i" } },
            ];
        }

        const safeSortBy = SORT_FIELDS.has(sortBy) ? sortBy : "createdAt";
        const direction = sortOrder === "asc" ? 1 : -1;
        const skip = (page - 1) * limit;

        const [projects, total] = await Promise.all([
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
            projects,
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

    async updateById(projectId, changes, session = null) {
        try {
            return await this.model.findOneAndUpdate(
                { _id: projectId },
                { $set: changes },
                { new: true, runValidators: true, session }
            );
        } catch (error) {
            throw new ApiError(422, `Unable to update project: ${error.message}`);
        }
    }

    async addAsset(projectId, assetId, session = null) {
        const project = await this.model.findOneAndUpdate(
            { _id: projectId, deletedAt: null },
            { $addToSet: { assets: assetId } },
            { new: true, session }
        );
        if (!project) throw new ApiError(404, "Active project not found");
        return project;
    }

    async removeAsset(projectId, assetId, session = null) {
        await this.model.findByIdAndUpdate(
            projectId,
            { $pull: { assets: assetId } },
            { session }
        );
        await this.model.updateOne(
            { _id: projectId, thumbnail: assetId },
            { $set: { thumbnail: null } },
            { session }
        );
        return this.model.findById(projectId).session(session);
    }

    async archive(projectId) {
        return this.updateById(projectId, { status: "archived" });
    }

    async softDelete(projectId) {
        return this.updateById(projectId, {
            status: "archived",
            visibility: "private",
            deletedAt: new Date(),
        });
    }

    async restore(projectId) {
        return this.updateById(projectId, {
            status: "active",
            deletedAt: null,
        });
    }
}

export default new ProjectRepository(Project);
