import express from "express";
import { protect } from "../auth/auth.middleware.js";
import {
    create,
    getById,
    list,
    remove,
    render,
    update,
} from "./video.controller.js";
import {
    validateCreateVideo,
    validateListVideos,
    validateUpdateVideo,
    validateVideoId,
} from "./video.validation.js";

const router = express.Router();

router.use(protect);

router
    .route("/")
    .post(validateCreateVideo, create)
    .get(validateListVideos, list);

router.post("/:videoId/render", validateVideoId, render);

router
    .route("/:videoId")
    .get(validateVideoId, getById)
    .patch(validateUpdateVideo, update)
    .delete(validateVideoId, remove);

export default router;
