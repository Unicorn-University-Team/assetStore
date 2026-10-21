import { Router } from 'express';
import { prisma } from '../db/prisma';
import { FileStorage } from '../storage/file-storage';
import { assetRoutes } from './asset.routes';

export const routes = Router();

async function probe(check: () => Promise<unknown>): Promise<'ok' | 'error'> {
  try {
    await check();
    return 'ok';
  } catch (error) {
    console.error(error);
    return 'error';
  }
}

routes.get('/health', async (_req, res) => {
  const [database, storage] = await Promise.all([
    probe(() => prisma.$queryRaw`SELECT 1`),
    probe(() => FileStorage.check()),
  ]);
  const ok = database === 'ok' && storage === 'ok';

  res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'error', database, storage });
});

routes.use('/assets', assetRoutes);
