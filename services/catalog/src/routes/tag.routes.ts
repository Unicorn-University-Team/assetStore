import { Router } from 'express';
import { TagController } from '../controllers/tag.controller';

export const tagRoutes = Router();

tagRoutes.get('/', TagController.list);
