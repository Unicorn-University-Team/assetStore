import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { HttpError } from '../utils/HttpError';

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

// Until the app has user accounts, changing data (upload, edit, delete) needs the team's shared key
// in the X-Write-Key header. Without WRITE_KEY, e.g. in local development, writing is open.
// Not the Authorization header: that one belongs to the site password (SITE_AUTH, see README).
export function requireWriteKey(req: Request, _res: Response, next: NextFunction) {
  if (!env.writeKey) {
    next();
    return;
  }
  // Comparing hashes keeps the comparison constant-time whatever the length of the given key.
  if (!timingSafeEqual(digest(req.get('X-Write-Key') ?? ''), digest(env.writeKey))) {
    throw new HttpError(401, 'Missing or wrong write key (X-Write-Key header)');
  }
  next();
}
