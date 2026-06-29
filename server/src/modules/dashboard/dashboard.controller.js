import ApiResponse from "../../utils/ApiResponse.js";
import asyncHandler from "../../middleware/asyncHandler.js";
import { getDashboard } from "./dashboard.service.js";

export const getOverview = asyncHandler(async (req, res) => {
    const dashboard = await getDashboard({
        userId: req.user.userId,
        range: req.query.range,
        recentLimit: req.query.recentLimit,
    });

    res.status(200).json(
        new ApiResponse(200, "Dashboard retrieved successfully", dashboard)
    );
});
