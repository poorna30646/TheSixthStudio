import ApiResponse from "../../utils/ApiResponse.js";
import asyncHandler from "../../middleware/asyncHandler.js";
import {
    createTemplate,
    deleteTemplate,
    getTemplate,
    listTemplates,
    updateTemplate,
} from "./template.service.js";

export const create = asyncHandler(async (req, res) => {
    const template = await createTemplate({
        data: req.body,
        user: req.user,
    });
    res.status(201).json(
        new ApiResponse(201, "Template created successfully", { template })
    );
});

export const list = asyncHandler(async (req, res) => {
    const result = await listTemplates(req.user, req.query);
    res.status(200).json(
        new ApiResponse(200, "Templates retrieved successfully", result)
    );
});

export const getById = asyncHandler(async (req, res) => {
    const template = await getTemplate(req.params.templateId, req.user);
    res.status(200).json(
        new ApiResponse(200, "Template retrieved successfully", { template })
    );
});

export const update = asyncHandler(async (req, res) => {
    const template = await updateTemplate(
        req.params.templateId,
        req.body,
        req.user
    );
    res.status(200).json(
        new ApiResponse(200, "Template updated successfully", { template })
    );
});

export const remove = asyncHandler(async (req, res) => {
    const template = await deleteTemplate(req.params.templateId, req.user);
    res.status(200).json(
        new ApiResponse(200, "Template deleted successfully", {
            templateId: template._id,
            deleted: true,
        })
    );
});
