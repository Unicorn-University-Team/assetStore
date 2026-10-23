import { errorHandler, notFound } from '@assetstore/shared';
import express from 'express';
import { env } from './config/env';
import { prisma } from './db/prisma';
import { routes } from './routes';
import { FileStorage } from './storage/file-storage';
import { renderStatusPage } from './views/status.view';

export const app = express();

app.use(express.json());

app.get('/', (_req, res) => {
  res.type('html').send(renderStatusPage({ nodeEnv: env.nodeEnv, uptimeSeconds: process.uptime() }));
});

async function probe(check: () => Promise<unknown>): Promise<'ok' | 'error'> {
  try {
    await check();
    return 'ok';
  } catch (error) {
    console.error(error);
    return 'error';
  }
}

// Docker healthcheck and Caddy (/api/health/catalog) use this; it is not part of the public API.
app.get('/health', async (_req, res) => {
  const [database, storage] = await Promise.all([
    probe(() => prisma.$queryRaw`SELECT 1`),
    probe(() => FileStorage.check()),
  ]);
  const ok = database === 'ok' && storage === 'ok';

  res.status(ok ? 200 : 503).json({ service: 'catalog', status: ok ? 'ok' : 'error', database, storage });
});

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);
