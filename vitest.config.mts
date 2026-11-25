import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolve paths consistently from repository and workspace npm scripts.
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    environment: 'node',
    // Workspace .test.ts files belong to Node's test runner (e.g. catalog tags).
    include: ['test/**/*.test.ts', 'services/**/test/**/*.spec.ts'],
    testTimeout: 10_000,
    hookTimeout: 10_000,
    restoreMocks: true,
  },
});
