import { strToU8, zipSync } from 'fflate';

/**
 * Shared zip fixtures for integration and E2E tests. Built at runtime with
 * fflate (the server's own dep) so the contents stay reviewable as code —
 * no opaque binary committed to git.
 */

const PACKAGE_JSON = JSON.stringify(
  { name: 'cdk-file-sharing', version: '0.1.0', devDependencies: { 'aws-cdk-lib': '^2.0.0' } },
  null,
  2,
);

const CDK_JSON = JSON.stringify({ app: 'npx ts-node bin/app.ts' }, null, 2);

const README_MD = `# 社内ファイル共有サービス (CDK)

S3 + API Gateway + Lambda + DynamoDB によるサーバーレス構成。

- 認証: Cognito ユーザープール
- ファイル本体: S3 (SSE-S3, 90日ライフサイクル)
- メタデータ: DynamoDB (TTL で本体と同期削除)
- 監視: CloudWatch アラーム
`;

const BIN_APP_TS = `import { App } from 'aws-cdk-lib';
import { FileShareStack } from '../lib/file-share-stack';

const app = new App();
new FileShareStack(app, 'FileShareStack');
`;

const LIB_STACK_TS = `import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

export class FileShareStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const bucket = new Bucket(this, 'FilesBucket', {
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: { blockPublicAcls: true } as never,
      lifecycleRules: [{ expiration: Duration.days(90) }],
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const table = new Table(this, 'FilesTable', {
      partitionKey: { name: 'userId', type: AttributeType.STRING },
      sortKey: { name: 'fileId', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAt',
    });

    void bucket;
    void table;
  }
}
`;

/** A tiny, valid CDK-like project: 5 text files, nested dirs. */
export function buildCdkZipBytes(): Uint8Array {
  return zipSync({
    'package.json': strToU8(PACKAGE_JSON),
    'cdk.json': strToU8(CDK_JSON),
    'README.md': strToU8(README_MD),
    'bin/app.ts': strToU8(BIN_APP_TS),
    'lib/file-share-stack.ts': strToU8(LIB_STACK_TS),
  });
}

/** Valid archive, zero entries → extraction yields NO_TEXT_FILES. */
export function buildEmptyZipBytes(): Uint8Array {
  return zipSync({});
}

/** Only a binary entry → NO_TEXT_FILES. */
export function buildBinaryOnlyZipBytes(): Uint8Array {
  return zipSync({ 'logo.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02, 0x03]) });
}

/** Only path-traversal entries → all dropped → NO_TEXT_FILES. */
export function buildTraversalOnlyZipBytes(): Uint8Array {
  return zipSync({ '../evil.ts': strToU8('export const evil = true;') });
}

/** Not a zip at all. */
export function buildNotAZipBytes(): Uint8Array {
  return new Uint8Array([0x01, 0x02, 0x03, 0x04]);
}

/** Multipart body helper for app.fetch / undici-style requests. */
export function buildZipFormData(bytes: Uint8Array, name = 'cdk-solution.zip'): FormData {
  const form = new FormData();
  // Uint8Array -> ArrayBuffer copy keeps the Blob free of SharedArrayBuffer typing issues.
  form.append(
    'file',
    new File([bytes.slice().buffer as ArrayBuffer], name, { type: 'application/zip' }),
  );
  return form;
}
