// Access-token generation utility.
import jwt from "jsonwebtoken";
import env from "../config/env.js";

const generateAccessToken = (payload) => {
    return jwt.sign(payload, env.JWT_SECRET, {
        expiresIn: "15m",
    });
};

export default generateAccessToken;