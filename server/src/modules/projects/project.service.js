import ApiError from "../../utils/ApiError.js";
import assetRepository from "../assets/asset.repository.js";
import projectRepository from "./project.repository.js";

const getProjectOrThrow = async (
    projectId,
    user,
    { includeDeleted = false } = {}
) => {
    const project = await projectRepository.findAccessibleById(
        projectId,
        user,
        { includeDeleted }
    );
    if (!project) throw new ApiError(404, "Project not found");
    return project;
};

const verifyThumbnail = async (thumbnailId, project, user) => {
    if (thumbnailId === null) return;

    const asset = await assetRepository.findAccessibleById(thumbnailId, user);
    if (
        !asset ||
        asset.type !== "image" ||
        asset.status !== "ready" ||
        String(asset.project) !== String(project._id)
    ) {
        throw new ApiError(
            422,
            "Thumbnail must be a ready image Asset belonging to this project"
        );
    }
};

export const assertProjectOwnership = async (projectId, user) => {
    const project = await getProjectOrThrow(projectId, user);
    if (project.status !== "active") {
        throw new ApiError(409, "Project is archived");
    }
    return project;
};

export const createProject = ({ ownerId, data }) =>
    projectRepository.create({
        title: data.title,
        description: data.description,
        visibility: data.visibility,
        status: "active",
        owner: ownerId,
        assets: [],
        settings: data.settings || {},
    });

export const listProjects = (user, filters) =>
    projectRepository.list(user, filters);

export const getProject = (projectId, user) =>
    getProjectOrThrow(projectId, user);

export const updateProject = async (projectId, changes, user) => {
    const project = await getProjectOrThrow(projectId, user);
    if (changes.thumbnail !== undefined) {
        await verifyThumbnail(changes.thumbnail, project, user);
    }

    const update = {};
    for (const field of [
        "title",
        "description",
        "thumbnail",
        "visibility",
    ]) {
        if (changes[field] !== undefined) update[field] = changes[field];
    }
    if (changes.settings !== undefined) {
        update.settings = { ...project.settings, ...changes.settings };
    }

    return projectRepository.updateById(project._id, update);
};

export const archiveProject = async (projectId, user) => {
    const project = await getProjectOrThrow(projectId, user);
    if (project.status === "archived") {
        throw new ApiError(409, "Project is already archived");
    }
    return projectRepository.archive(project._id);
};

export const deleteProject = async (projectId, user) => {
    const project = await getProjectOrThrow(projectId, user);
    return projectRepository.softDelete(project._id);
};

export const restoreProject = async (projectId, user) => {
    const project = await getProjectOrThrow(projectId, user, {
        includeDeleted: true,
    });
    if (!project.deletedAt && project.status === "active") {
        throw new ApiError(409, "Project is already active");
    }
    return projectRepository.restore(project._id);
};

export default {
    assertProjectOwnership,
    createProject,
    listProjects,
    getProject,
    updateProject,
    archiveProject,
    deleteProject,
    restoreProject,
};
