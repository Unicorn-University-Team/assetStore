import { Router } from 'express';
import { AssetController } from '../controllers/asset.controller';

export const assetRoutes = Router();

assetRoutes.get('/', AssetController.list);
assetRoutes.post('/', AssetController.create);
assetRoutes.get('/:id', AssetController.getById);
assetRoutes.get('/:id/download', AssetController.download);
assetRoutes.put('/:id', AssetController.update);
assetRoutes.delete('/:id', AssetController.remove);
