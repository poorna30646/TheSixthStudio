import ApiResponse from "../../utils/ApiResponse.js";
import asyncHandler from "../../middleware/asyncHandler.js";
import {
    archiveProject,
    createProject,
    deleteProject,
    getProject,
    listProjects,
    restoreProject,
    updateProject,
} from "./project.service.js";

export const create = asyncHandler(async (req, res) => {
    const project = await createProject({
        ownerId: req.user.userId,
        data: req.body,
    });
    res.status(201).json(
        new ApiResponse(201, "Project created successfully", { project })
    );
});

export const list = asyncHandler(async (req, res) => {
    const result = await listProjects(req.user, req.query);
    res.status(200).json(
        new ApiResponse(200, "Projects retrieved successfully", result)
    );
});

export const getById = asyncHandler(async (req, res) => {
    const project = await getProject(req.params.projectId, req.user);
    res.status(200).json(
        new ApiResponse(200, "Project retrieved successfully", { project })
    );
});

export const update = asyncHandler(async (req, res) => {
    const project = await updateProject(
        req.params.projectId,
        req.body,
        req.user
    );
    res.status(200).json(
        new ApiResponse(200, "Project updated successfully", { project })
    );
});

export const archive = asyncHandler(async (req, res) => {
    const project = await archiveProject(req.params.projectId, req.user);
    res.status(200).json(
        new ApiResponse(200, "Project archived successfully", { project })
    );
});

export const remove = asyncHandler(async (req, res) => {
    const project = await deleteProject(req.params.projectId, req.user);
    res.status(200).json(
        new ApiResponse(200, "Project deleted successfully", {
            projectId: project._id,
            deletedAt: project.deletedAt,
        })
    );
});

export const restore = asyncHandler(async (req, res) => {
    const project = await restoreProject(req.params.projectId, req.user);
    res.status(200).json(
        new ApiResponse(200, "Project restored successfully", { project })
    );
});
