import express from 'express';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { notFound } from './middlewares/notFound';
import { routes } from './routes';
import { renderStatusPage } from './views/status.view';

export const app = express();

app.use(express.json());

app.get('/', (_req, res) => {
  res.type('html').send(renderStatusPage({ nodeEnv: env.nodeEnv, uptimeSeconds: process.uptime() }));
});

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);
