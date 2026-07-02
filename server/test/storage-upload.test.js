import assert from "node:assert/strict";
import test from "node:test";
import {
    assertUploadedObjectMatchesPendingAsset,
} from "../src/modules/assets/asset.service.js";
import {
    buildHeadObjectFailureDiagnostic,
    generatePresignedUploadUrl,
} from "../src/modules/storage/services/signedUrl.service.js";
import {
    S3_BUCKET_NAME,
    S3_EXPECTED_BUCKET_OWNER,
    S3_REGION,
} from "../src/modules/storage/config/s3.config.js";

const user = {
    userId: "507f1f77bcf86cd799439011",
    role: "user",
};

const pendingAsset = {
    size: 12,
    mimeType: "application/json",
    metadata: {
        originalName: "asset.json",
    },
};

const objectMetadata = {
    ContentLength: 12,
    ContentType: "application/json",
    ServerSideEncryption: "AES256",
    Metadata: {
        "uploaded-by": user.userId,
        "original-name": encodeURIComponent("asset.json"),
    },
};

test("uploaded object metadata must exactly match the pending asset", () => {
    assert.doesNotThrow(() =>
        assertUploadedObjectMatchesPendingAsset(
            objectMetadata,
            pendingAsset,
            user
        )
    );

    for (const changedMetadata of [
        { ...objectMetadata, ContentLength: 13 },
        { ...objectMetadata, ContentType: "application/pdf" },
        { ...objectMetadata, ServerSideEncryption: undefined },
        {
            ...objectMetadata,
            Metadata: {
                ...objectMetadata.Metadata,
                "uploaded-by": "507f191e810c19729de860ea",
            },
        },
        {
            ...objectMetadata,
            Metadata: {
                ...objectMetadata.Metadata,
                "original-name": encodeURIComponent("other.json"),
            },
        },
    ]) {
        assert.throws(
            () =>
                assertUploadedObjectMatchesPendingAsset(
                    changedMetadata,
                    pendingAsset,
                    user
                ),
            (error) => [403, 422].includes(error.statusCode)
        );
    }
});

test("presigned upload binds all security-sensitive headers", async () => {
    const result = await generatePresignedUploadUrl({
        key: "thesixthstudio/temp/123e4567-e89b-42d3-a456-426614174000.json",
        mimeType: "application/json",
        fileSize: 12,
        userId: user.userId,
        originalFileName: "asset.json",
        expiresIn: 900,
    });
    const uploadUrl = new URL(result.uploadUrl);
    const signedHeaders = new Set(
        uploadUrl.searchParams.get("X-Amz-SignedHeaders").split(";")
    );

    for (const header of [
        "content-length",
        "content-type",
        "host",
        "if-none-match",
        "x-amz-meta-original-name",
        "x-amz-meta-uploaded-by",
        "x-amz-server-side-encryption",
    ]) {
        assert.equal(signedHeaders.has(header), true);
    }

    assert.equal(
        uploadUrl.searchParams.get("x-amz-expected-bucket-owner"),
        S3_EXPECTED_BUCKET_OWNER
    );
    assert.equal(
        uploadUrl.hostname,
        `${S3_BUCKET_NAME}.s3.${S3_REGION}.amazonaws.com`
    );
    assert.equal(
        decodeURIComponent(uploadUrl.pathname),
        "/thesixthstudio/temp/123e4567-e89b-42d3-a456-426614174000.json"
    );
    assert.deepEqual(result.requiredHeaders, {
        "Content-Type": "application/json",
        "Content-Length": "12",
        "If-None-Match": "*",
        "x-amz-server-side-encryption": "AES256",
        "x-amz-meta-uploaded-by": user.userId,
        "x-amz-meta-original-name": encodeURIComponent("asset.json"),
    });
});

test("HeadObject failures produce complete structured diagnostics", () => {
    const commandInput = {
        Bucket: S3_BUCKET_NAME,
        Key: "thesixthstudio/temp/123e4567-e89b-42d3-a456-426614174000.json",
        ExpectedBucketOwner: S3_EXPECTED_BUCKET_OWNER,
    };
    const error = Object.assign(new Error("Access Denied"), {
        name: "AccessDenied",
        $metadata: {
            httpStatusCode: 403,
            requestId: "request-id",
            extendedRequestId: "extended-request-id",
            attempts: 1,
            totalRetryDelay: 0,
        },
    });

    assert.deepEqual(
        buildHeadObjectFailureDiagnostic(error, commandInput),
        {
            event: "s3_head_object_failed",
            bucket: S3_BUCKET_NAME,
            key: commandInput.Key,
            region: S3_REGION,
            awsAccountOwner: S3_EXPECTED_BUCKET_OWNER,
            requestId: "request-id",
            extendedRequestId: "extended-request-id",
            sdkErrorName: "AccessDenied",
            sdkErrorMessage: "Access Denied",
            sdkMetadata: error.$metadata,
            headObjectCommandInput: commandInput,
        }
    );
});
