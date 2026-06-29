import express from "express";

import healthRoutes from "../modules/health/health.routes.js";
import authRoutes from "../modules/auth/auth.routes.js";
import storageRoutes from "../modules/storage/routes/storage.routes.js";

const router = express.Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/storage", storageRoutes);

export default router;
