import { Router } from 'express';
import { assetRoutes } from './asset.routes';

export const routes = Router();

routes.use('/assets', assetRoutes);
