import { Router } from 'express';
import { assetRoutes } from './asset.routes';
import { tagRoutes } from './tag.routes';

export const routes = Router();

routes.use('/assets', assetRoutes);
routes.use('/tags', tagRoutes);
