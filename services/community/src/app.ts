import { errorHandler, notFound } from '@assetstore/shared';
import cookieParser from 'cookie-parser';
import express from 'express';
import { prisma } from './db/prisma';
import { assetReportRoutes, reportRoutes } from './routes/report.routes';
import { assetReviewRoutes } from './routes/review.routes';

export const app = express();

app.use(express.json());
// Reads the access_token cookie for requireAuth; must come before the routes.
app.use(cookieParser());

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
app.use('/api/assets/:assetId/reports', assetReportRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/assets/:assetId/reviews', assetReviewRoutes);


app.use(notFound);
app.use(errorHandler);
