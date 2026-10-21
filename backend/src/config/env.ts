import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is not set (see .env.example)`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT) || 3000,
  databaseUrl: required('DATABASE_URL'),
  // AWS credentials are not read here: the AWS SDK takes them from the EC2 instance role on the server
  // and from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in .env locally.
  s3Bucket: required('S3_BUCKET'),
  awsRegion: process.env.AWS_REGION ?? 'eu-central-1',
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB) || 100,
};
