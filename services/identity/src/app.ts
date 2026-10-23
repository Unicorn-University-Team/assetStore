import { errorHandler, notFound } from '@assetstore/shared';
import express from 'express';
import { prisma } from './db/prisma';

export const app = express();

app.use(express.json());

// Docker healthcheck and Caddy (/api/health/identity) use this; it is not part of the public API.
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ service: 'identity', status: 'ok', database: 'ok' });
  } catch (error) {
    console.error(error);
    res.status(503).json({ service: 'identity', status: 'error', database: 'error' });
  }
});

// Public routes of this service (Caddy sends them here, see deploy/Caddyfile):
//   /api/auth/...   registration, login, logout, current user
//   /api/users/...  user list and deletion (admin)

app.use(notFound);
app.use(errorHandler);
