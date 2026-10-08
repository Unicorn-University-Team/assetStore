import { Router } from 'express';
import { assetRoutes } from './asset.routes';

export const routes = Router();

routes.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

routes.use('/assets', assetRoutes);
