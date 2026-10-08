import express from 'express';
import { errorHandler } from './middlewares/errorHandler';
import { notFound } from './middlewares/notFound';
import { routes } from './routes';

export const app = express();

app.use(express.json());

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);
