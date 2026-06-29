import express from "express";
import { protect } from "../../auth/auth.middleware.js";
import {
    getDownloadUrl,
    getUploadUrl,
    removeObject,
} from "../controllers/storage.controller.js";
import {
    validateDeleteObject,
    validateDownloadUrl,
    validateUploadUrl,
} from "../validators/storage.validation.js";

const router = express.Router();

router.use(protect);

router.post("/upload-url", validateUploadUrl, getUploadUrl);
router.post("/download-url", validateDownloadUrl, getDownloadUrl);
router.delete("/object", validateDeleteObject, removeObject);

export default router;
