import { Router } from 'express';
import { AssetController } from '../controllers/asset.controller';
import { requireWriteKey } from '../middlewares/requireWriteKey';

export const assetRoutes = Router();

assetRoutes.get('/', AssetController.list);
assetRoutes.post('/', requireWriteKey, AssetController.create);
assetRoutes.get('/:id', AssetController.getById);
assetRoutes.get('/:id/download', AssetController.download);
assetRoutes.put('/:id', requireWriteKey, AssetController.update);
assetRoutes.delete('/:id', requireWriteKey, AssetController.remove);
