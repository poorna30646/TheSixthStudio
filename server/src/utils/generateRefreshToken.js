// Refresh-token generation utility.
import jwt from "jsonwebtoken";
import env from "../config/env.js";

const generateRefreshToken = (payload) => {
    return jwt.sign(payload, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN,
    });
};

export default generateRefreshToken;