import 'dotenv/config';
import { requiredEnv } from '@assetstore/shared';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT) || 3001,
  databaseUrl: requiredEnv('DATABASE_URL'),
};
