import { app } from './app';
import { env } from './config/env';

app.listen(env.port, () => {
  console.log(`Community service is running on http://localhost:${env.port} (${env.nodeEnv})`);
});
