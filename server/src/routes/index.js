import express from "express";

import healthRoutes from "../modules/health/health.routes.js";
import authRoutes from "../modules/auth/auth.routes.js";

const router = express.Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);

export default router;