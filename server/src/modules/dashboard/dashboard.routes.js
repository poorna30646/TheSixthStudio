import express from "express";
import { protect } from "../auth/auth.middleware.js";
import { getOverview } from "./dashboard.controller.js";
import { validateDashboardQuery } from "./dashboard.validation.js";

const router = express.Router();

router.use(protect);
router.get("/", validateDashboardQuery, getOverview);

export default router;
