import express from "express";

import healthRoutes from "../modules/health/health.routes.js";
import authRoutes from "../modules/auth/auth.routes.js";
import storageRoutes from "../modules/storage/routes/storage.routes.js";
import assetRoutes from "../modules/assets/asset.routes.js";
import projectRoutes from "../modules/projects/project.routes.js";
import templateRoutes from "../modules/templates/template.routes.js";

const router = express.Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/storage", storageRoutes);
router.use("/assets", assetRoutes);
router.use("/projects", projectRoutes);
router.use("/templates", templateRoutes);

export default router;
