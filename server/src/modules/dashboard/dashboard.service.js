import ApiError from "../../utils/ApiError.js";
import dashboardRepository from "./dashboard.repository.js";

const startOfUtcDay = (date) =>
    new Date(
        Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate()
        )
    );

const buildActivitySeries = (
    range,
    startDate,
    projects,
    assets,
    videosRendered
) => {
    const projectMap = new Map(projects.map((item) => [item._id, item.count]));
    const assetMap = new Map(assets.map((item) => [item._id, item.count]));
    const videoMap = new Map(
        videosRendered.map((item) => [item._id, item.count])
    );

    return Array.from({ length: range }, (_, index) => {
        const date = new Date(startDate);
        date.setUTCDate(date.getUTCDate() + index);
        const key = date.toISOString().slice(0, 10);
        return {
            date: key,
            projects: projectMap.get(key) || 0,
            assets: assetMap.get(key) || 0,
            videosRendered: videoMap.get(key) || 0,
        };
    });
};

export const getDashboard = async ({
    userId,
    range = 30,
    recentLimit = 5,
}) => {
    const today = startOfUtcDay(new Date());
    const startDate = new Date(today);
    startDate.setUTCDate(startDate.getUTCDate() - (range - 1));

    const [
        user,
        projectsCount,
        storage,
        videosRendered,
        templatesUsed,
        recentProjects,
        recentAssets,
        recentVideos,
        projectActivity,
        assetActivity,
        renderedVideoActivity,
        storageByType,
        videosByStatus,
        templateUsage,
    ] = await Promise.all([
        dashboardRepository.getUserStorageLimit(userId),
        dashboardRepository.getProjectCount(userId),
        dashboardRepository.getStorageSummary(userId),
        dashboardRepository.getRenderedVideoCount(userId),
        dashboardRepository.getTemplatesUsedCount(userId),
        dashboardRepository.getRecentProjects(userId, recentLimit),
        dashboardRepository.getRecentAssets(userId, recentLimit),
        dashboardRepository.getRecentVideos(userId, recentLimit),
        dashboardRepository.getProjectActivity(userId, startDate),
        dashboardRepository.getAssetActivity(userId, startDate),
        dashboardRepository.getRenderedVideoActivity(userId, startDate),
        dashboardRepository.getStorageByType(userId),
        dashboardRepository.getVideosByStatus(userId),
        dashboardRepository.getTemplateUsage(userId),
    ]);

    if (!user) throw new ApiError(404, "User not found");

    const storageLimit = user.storageLimit || 0;
    const storageUsed = storage.storageUsed || 0;
    const storageRemaining = Math.max(0, storageLimit - storageUsed);

    return {
        statistics: {
            projectsCount,
            assetsCount: storage.assetCount || 0,
            storageUsed,
            storageLimit,
            storageRemaining,
            storagePercentage:
                storageLimit > 0
                    ? Number(
                          Math.min(100, (storageUsed / storageLimit) * 100).toFixed(
                              2
                          )
                      )
                    : 0,
            videosRendered,
            templatesUsed,
        },
        recent: {
            projects: recentProjects,
            assets: recentAssets,
            videos: recentVideos,
        },
        charts: {
            rangeDays: range,
            activity: buildActivitySeries(
                range,
                startDate,
                projectActivity,
                assetActivity,
                renderedVideoActivity
            ),
            storageByType,
            videosByStatus,
            templateUsage,
        },
    };
};

export default { getDashboard };
