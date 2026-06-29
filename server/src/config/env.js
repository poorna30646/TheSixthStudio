import dotenv from "dotenv";

dotenv.config();

const env = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
  CLIENT_URL: process.env.CLIENT_URL,
  AWS_REGION: process.env.AWS_REGION,
  AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_ROOT_FOLDER: process.env.AWS_ROOT_FOLDER,
};

export default Object.freeze(env);
