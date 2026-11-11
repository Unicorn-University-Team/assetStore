import 'dotenv/config';
import { requiredEnv } from '@assetstore/shared';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT) || 3002,
  databaseUrl: requiredEnv('DATABASE_URL'),
  // AWS credentials are not read here: the AWS SDK takes them from the EC2 instance role on the server
  // and from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in .env locally.
  s3Bucket: requiredEnv('S3_BUCKET'),
  awsRegion: process.env.AWS_REGION ?? 'eu-central-1',
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB) || 100,
  // Upper limit for all asset files together; uploads are refused once it is reached.
  maxStorageGb: Number(process.env.MAX_STORAGE_GB) || 5,
  // Shared secret that other services send in X-Internal-Key on /internal routes. Empty = not checked.
  internalKey: process.env.INTERNAL_KEY ?? '',
  // Public key from identity for checking access tokens (README, Přihlášení). Empty = writing answers 503.
  jwtPublicKey: process.env.JWT_PUBLIC_KEY ?? '',
};
