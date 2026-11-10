import { requireAuth } from '@assetstore/shared';
import { Router } from 'express';
import { loadPublicKey } from '../auth/jwt';
import { AssetController } from '../controllers/asset.controller';

export const assetRoutes = Router();

assetRoutes.get('/', AssetController.list);
assetRoutes.post('/', requireAuth(loadPublicKey), AssetController.create);
assetRoutes.get('/:id', AssetController.getById);
assetRoutes.get('/:id/download', AssetController.download);
assetRoutes.put('/:id', requireAuth(loadPublicKey), AssetController.update);
assetRoutes.delete('/:id', requireAuth(loadPublicKey), AssetController.remove);
