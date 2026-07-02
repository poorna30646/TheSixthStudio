# TheSixthStudio storage deployment

The server must run with an AWS execution role. Do not put long-lived IAM
user access keys in `.env`, a container definition, or a deployment secret.

`storage-stack.yaml` creates a private, encrypted, versioned bucket with
bucket-owner-enforced ownership, exact-origin CORS, and a runtime policy
limited to the application's root prefix. The runtime role has only the
object actions used by the server:

- `s3:PutObject` for presigned uploads
- `s3:GetObject` for `HeadObject`, verification, and presigned downloads
- `s3:DeleteObject` for asset deletion

`HeadObject` is authorized by `s3:GetObject`; it has no separate IAM action.

Deploy this stack from an AWS administration session, not from the
application runtime identity:

```sh
aws cloudformation deploy \
  --template-file infrastructure/aws/storage-stack.yaml \
  --stack-name thesixthstudio-storage \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    BucketName=<private-bucket-name> \
    RootPrefix=thesixthstudio \
    ApplicationRoleName=<server-execution-role-name> \
    AllowedOrigins=https://<frontend-host>
```

Configure the server with the stack outputs:

```text
AWS_REGION=<bucket-region>
AWS_BUCKET_NAME=<BucketName output>
AWS_EXPECTED_BUCKET_OWNER=<BucketOwnerAccountId output>
AWS_ROOT_FOLDER=<RootPrefix output>
```

For an existing bucket, import it into the stack before deployment or apply
the equivalent controls during a planned migration. Remove every public
bucket-policy statement, enable all four S3 Block Public Access settings, keep
`BucketOwnerEnforced`, and configure the CORS rule from the template.

If AWS attached `AWSCompromisedKeyQuarantineV3`, follow the instructions in
the AWS support/security notification. Do not detach the quarantine policy as
a workaround. Disable and delete the exposed key, rotate any other exposed
credentials, review CloudTrail and bucket contents, resolve the AWS support
case, and deploy the server with the execution role. An explicit quarantine
deny cannot be overridden by adding another IAM or bucket-policy allow.
