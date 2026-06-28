import app from "./app.js";
import env from "./config/env.js";
import connectDB from "./config/db.js";
import logger from "./config/logger.js";

const startServer = async () => {
    try {
        await connectDB();

        app.listen(env.PORT, () => {
            logger.success(
                `🚀 Server running on http://localhost:${env.PORT}`
            );
        });

    } catch (error) {

        logger.error(error.message);

        process.exit(1);

    }
};

startServer();