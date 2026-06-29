import express from "express";
import { protect } from "../auth/auth.middleware.js";
import {
    archive,
    create,
    getById,
    list,
    remove,
    restore,
    update,
} from "./project.controller.js";
import {
    validateCreateProject,
    validateListProjects,
    validateProjectId,
    validateUpdateProject,
} from "./project.validation.js";

const router = express.Router();

router.use(protect);

router
    .route("/")
    .post(validateCreateProject, create)
    .get(validateListProjects, list);

router.post("/:projectId/archive", validateProjectId, archive);
router.post("/:projectId/restore", validateProjectId, restore);

router
    .route("/:projectId")
    .get(validateProjectId, getById)
    .patch(validateUpdateProject, update)
    .delete(validateProjectId, remove);

export default router;
