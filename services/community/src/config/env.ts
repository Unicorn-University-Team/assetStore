import 'dotenv/config';
import { requiredEnv } from '@assetstore/shared';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT) || 3003,
  databaseUrl: requiredEnv('DATABASE_URL'),
  // Other services, called directly on their /internal routes (see README, service-to-service communication).
  catalogUrl: process.env.CATALOG_URL || 'http://localhost:3002',
  identityUrl: process.env.IDENTITY_URL || 'http://localhost:3001',
  // Shared secret sent in the X-Internal-Key header on calls to other services.
  internalKey: process.env.INTERNAL_KEY ?? '',
  // Public key from identity for checking access tokens (README, Přihlášení). Empty = reports answer 503.
  jwtPublicKey: process.env.JWT_PUBLIC_KEY ?? '',
};
