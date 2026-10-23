import { errorHandler, notFound } from '@assetstore/shared';
import express from 'express';
import { prisma } from './db/prisma';

export const app = express();

app.use(express.json());

// Docker healthcheck and Caddy (/api/health/community) use this; it is not part of the public API.
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ service: 'community', status: 'ok', database: 'ok' });
  } catch (error) {
    console.error(error);
    res.status(503).json({ service: 'community', status: 'error', database: 'error' });
  }
});

// Public routes of this service (Caddy sends them here, see deploy/Caddyfile):
//   /api/assets/:id/reviews, /api/reviews/...    reviews
//   /api/collections/...                         collections
//   /api/assets/:id/reports, /api/reports/...    reports

app.use(notFound);
app.use(errorHandler);
