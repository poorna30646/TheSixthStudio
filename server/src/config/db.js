import mongoose from "mongoose";
import env from "./env.js";
import logger from "./logger.js";

const connectDB = async () => {
  if (!env.MONGO_URI) {
    throw new Error("MONGO_URI environment variable is required");
  }

  await mongoose.connect(env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  logger.success("MongoDB connected successfully");
  return mongoose.connection;
};

export default connectDB;
