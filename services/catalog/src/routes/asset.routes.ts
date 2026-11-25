import { requireAuth } from '@assetstore/shared';
import { Router } from 'express';
import { loadPublicKey } from '../auth/jwt';
import { AssetController } from '../controllers/asset.controller';

export const assetRoutes = Router();

assetRoutes.get('/', AssetController.list);
assetRoutes.post('/', requireAuth(loadPublicKey), AssetController.create);
assetRoutes.get('/:id', AssetController.getById);
assetRoutes.get('/:id/download', AssetController.download);
assetRoutes.get('/:id/preview', AssetController.previewImage);
// Not in the AM: the asset file itself for the 3D viewer and the sound player on the asset page.
assetRoutes.get('/:id/file', AssetController.preview);
assetRoutes.put('/:id', requireAuth(loadPublicKey), AssetController.update);
assetRoutes.delete('/:id', requireAuth(loadPublicKey), AssetController.remove);
