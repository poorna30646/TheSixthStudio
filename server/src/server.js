import app from "./app.js";
import env from "./config/env.js";
import connectDB from "./config/db.js";
import logger from "./config/logger.js";
import mongoose from "mongoose";
import { closeVideoRenderQueue } from "./modules/videos/video.queue.js";

let server;

const shutdown = async (signal) => {
    logger.info(`${signal} received; shutting down`);
    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }
    await closeVideoRenderQueue();
    await mongoose.connection.close();
};

const startServer = async () => {
    try {
        await connectDB();
        server = app.listen(env.PORT, () => {
            logger.success(`Server running on http://localhost:${env.PORT}`);
        });
    } catch (error) {
        logger.error(error.message);
        process.exitCode = 1;
    }
};

for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, async () => {
        try {
            await shutdown(signal);
            process.exit(0);
        } catch (error) {
            logger.error(`Shutdown failed: ${error.message}`);
            process.exit(1);
        }
    });
}

process.on("unhandledRejection", (error) => {
    logger.error(`Unhandled rejection: ${error?.stack || error}`);
});

startServer();
