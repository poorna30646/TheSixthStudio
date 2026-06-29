import ApiError from "../../utils/ApiError.js";
import assetRepository from "../assets/asset.repository.js";
import templateRepository from "./template.repository.js";

const getTemplateOrThrow = async (templateId, user) => {
    const template = await templateRepository.findAccessibleById(
        templateId,
        user
    );
    if (!template) throw new ApiError(404, "Template not found");
    return template;
};

const uniqueIds = (ids) => [...new Set(ids.map(String))];

const verifyAssets = async (assetIds, thumbnailId, user) => {
    const ids = uniqueIds(assetIds);
    const assets = await assetRepository.findAccessibleByIds(ids, user);

    if (assets.length !== ids.length) {
        throw new ApiError(
            422,
            "Every referenced Asset must exist and belong to the template owner"
        );
    }

    if (assets.some((asset) => asset.status !== "ready")) {
        throw new ApiError(422, "Templates can only reference ready Assets");
    }

    if (thumbnailId) {
        if (!ids.includes(String(thumbnailId))) {
            throw new ApiError(
                422,
                "Thumbnail must be included in the template assets"
            );
        }
        const thumbnail = assets.find(
            (asset) => String(asset._id) === String(thumbnailId)
        );
        if (thumbnail?.type !== "image") {
            throw new ApiError(422, "Thumbnail Asset must be an image");
        }
    }

    return ids;
};

export const createTemplate = async ({ data, user }) => {
    const assets = await verifyAssets(data.assets, data.thumbnail, user);

    return templateRepository.create({
        title: data.title,
        description: data.description,
        category: data.category,
        owner: user.userId,
        assets,
        thumbnail: data.thumbnail || null,
        status: data.status || "draft",
        isPublic: data.isPublic ?? false,
        tags: data.tags || [],
        metadata: data.metadata || {},
    });
};

export const listTemplates = (user, filters) =>
    templateRepository.list(user, filters);

export const getTemplate = (templateId, user) =>
    getTemplateOrThrow(templateId, user);

export const updateTemplate = async (templateId, changes, user) => {
    const template = await getTemplateOrThrow(templateId, user);
    const assetIds = changes.assets || template.assets;
    const thumbnail =
        changes.thumbnail !== undefined
            ? changes.thumbnail
            : template.thumbnail;

    if (
        changes.assets !== undefined ||
        changes.thumbnail !== undefined
    ) {
        await verifyAssets(assetIds, thumbnail, user);
    }

    const update = {};
    for (const field of [
        "title",
        "description",
        "category",
        "assets",
        "thumbnail",
        "status",
        "isPublic",
        "tags",
    ]) {
        if (changes[field] !== undefined) {
            update[field] =
                field === "assets" ? uniqueIds(changes[field]) : changes[field];
        }
    }
    if (changes.metadata !== undefined) {
        update.metadata = { ...template.metadata, ...changes.metadata };
    }

    return templateRepository.updateById(template._id, update);
};

export const deleteTemplate = async (templateId, user) => {
    const template = await getTemplateOrThrow(templateId, user);
    return templateRepository.softDelete(template._id);
};

export default {
    createTemplate,
    listTemplates,
    getTemplate,
    updateTemplate,
    deleteTemplate,
};
