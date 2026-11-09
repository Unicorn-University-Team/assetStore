import { HttpError, type PublicKey } from '@assetstore/shared';
import { importSPKI } from 'jose';
import { env } from '../config/env';

// Public key from identity (base64 of the PEM file in env), imported once, on first use.
// Copy of the same function in identity; worth moving to packages/shared.
let publicKey: Promise<PublicKey> | undefined;

export function loadPublicKey(): Promise<PublicKey> {
  if (!env.jwtPublicKey) {
    throw new HttpError(503, 'Writing is not available: JWT_PUBLIC_KEY is not set.');
  }
  publicKey ??= importSPKI(Buffer.from(env.jwtPublicKey, 'base64').toString('utf8'), 'RS256');
  return publicKey;
}
