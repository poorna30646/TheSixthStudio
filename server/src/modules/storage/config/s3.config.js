import { S3Client } from "@aws-sdk/client-s3";
import env from "../../../config/env.js";

const requireEnvironmentValue = (name, value) => {
    if (!value || !String(value).trim()) {
        throw new Error(`${name} is required to configure S3 storage`);
    }

    return String(value).trim();
};

const normalizeRootFolder = (value) => {
    const rootFolder = requireEnvironmentValue("AWS_ROOT_FOLDER", value)
        .replace(/^\/+|\/+$/g, "");

    const segments = rootFolder.split("/");
    const hasUnsafeSegment = segments.some(
        (segment) =>
            !segment ||
            segment === "." ||
            segment === ".." ||
            !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(segment)
    );

    if (hasUnsafeSegment) {
        throw new Error(
            "AWS_ROOT_FOLDER must contain only safe path segments"
        );
    }

    return rootFolder;
};

export const S3_BUCKET_NAME = requireEnvironmentValue(
    "AWS_BUCKET_NAME",
    env.AWS_BUCKET_NAME
);

export const S3_ROOT_FOLDER = normalizeRootFolder(env.AWS_ROOT_FOLDER);

const region = requireEnvironmentValue("AWS_REGION", env.AWS_REGION);
const hasAccessKey = Boolean(env.AWS_ACCESS_KEY_ID);
const hasSecretKey = Boolean(env.AWS_SECRET_ACCESS_KEY);

if (hasAccessKey !== hasSecretKey) {
    throw new Error(
        "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be configured together"
    );
}

const s3Client = new S3Client({
    region,
    maxAttempts: 3,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    ...(hasAccessKey && hasSecretKey
        ? {
              credentials: {
                  accessKeyId: env.AWS_ACCESS_KEY_ID,
                  secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
              },
          }
        : {}),
});

export default s3Client;
