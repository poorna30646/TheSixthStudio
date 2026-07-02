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

export const S3_REGION = requireEnvironmentValue(
    "AWS_REGION",
    env.AWS_REGION
);
export const S3_EXPECTED_BUCKET_OWNER = requireEnvironmentValue(
    "AWS_EXPECTED_BUCKET_OWNER",
    env.AWS_EXPECTED_BUCKET_OWNER
);

if (!/^\d{12}$/.test(S3_EXPECTED_BUCKET_OWNER)) {
    throw new Error(
        "AWS_EXPECTED_BUCKET_OWNER must be a 12-digit AWS account ID"
    );
}

const hasAccessKey = Boolean(env.AWS_ACCESS_KEY_ID);
const hasSecretKey = Boolean(env.AWS_SECRET_ACCESS_KEY);
const hasSessionToken = Boolean(env.AWS_SESSION_TOKEN);

if (hasAccessKey !== hasSecretKey) {
    throw new Error(
        "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be configured together"
    );
}

if (hasSessionToken && (!hasAccessKey || !hasSecretKey)) {
    throw new Error(
        "AWS_SESSION_TOKEN requires AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY"
    );
}

if (env.NODE_ENV === "production" && hasAccessKey && !hasSessionToken) {
    throw new Error(
        "Long-lived AWS access keys are not supported in production; use an AWS execution role"
    );
}

const s3Client = new S3Client({
    region: S3_REGION,
    forcePathStyle: false,
    maxAttempts: 3,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
});

export default s3Client;
