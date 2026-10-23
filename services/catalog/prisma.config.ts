import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // process.env, not env(): `prisma generate` must also work without a database (e.g. in the Docker build).
    url: process.env.DATABASE_URL,
  },
});
