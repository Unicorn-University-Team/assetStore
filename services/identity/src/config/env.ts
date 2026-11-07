import 'dotenv/config';
import { requiredEnv } from '@assetstore/shared';

const nodeEnv = process.env.NODE_ENV ?? 'development';

export const env = {
  nodeEnv,
  port: Number(process.env.PORT) || 3001,
  databaseUrl: requiredEnv('DATABASE_URL'),
  // RS256 key pair for access tokens: PEM files encoded with base64 into one line (README, Přihlášení).
  // Empty = the service starts, but login and refresh answer 503.
  jwtPrivateKey: process.env.JWT_PRIVATE_KEY ?? '',
  jwtPublicKey: process.env.JWT_PUBLIC_KEY ?? '',
  // The server runs on HTTPS, so its cookies are sent only over HTTPS; locally it is plain HTTP.
  cookieSecure: nodeEnv === 'production',
};
