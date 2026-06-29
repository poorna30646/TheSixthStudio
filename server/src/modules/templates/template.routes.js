import express from "express";
import { protect } from "../auth/auth.middleware.js";
import {
    create,
    getById,
    list,
    remove,
    update,
} from "./template.controller.js";
import {
    validateCreateTemplate,
    validateListTemplates,
    validateTemplateId,
    validateUpdateTemplate,
} from "./template.validation.js";

const router = express.Router();

router.use(protect);

router
    .route("/")
    .post(validateCreateTemplate, create)
    .get(validateListTemplates, list);

router
    .route("/:templateId")
    .get(validateTemplateId, getById)
    .patch(validateUpdateTemplate, update)
    .delete(validateTemplateId, remove);

export default router;
