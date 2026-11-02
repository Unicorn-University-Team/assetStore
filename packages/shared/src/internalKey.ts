import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './HttpError';

// Header with the shared secret on calls between services (/internal routes). See README.
export const INTERNAL_KEY_HEADER = 'X-Internal-Key';

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

// Protects /internal routes: only other services, which know INTERNAL_KEY, may call them.
// Caddy does not route /internal from outside at all; this check is a second line of defence.
// Empty key (local development) = not checked.
// Usage: app.use('/internal', requireInternalKey(env.internalKey), internalRoutes);
export function requireInternalKey(expectedKey: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!expectedKey) {
      next();
      return;
    }
    // Comparing hashes keeps the comparison constant-time whatever the length of the given key.
    if (!timingSafeEqual(digest(req.get(INTERNAL_KEY_HEADER) ?? ''), digest(expectedKey))) {
      throw new HttpError(401, `Missing or wrong internal key (${INTERNAL_KEY_HEADER} header)`);
    }
    next();
  };
}
