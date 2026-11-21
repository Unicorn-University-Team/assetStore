import type { Express } from 'express';
import type { Server } from 'node:http';

export async function serve(app: Express) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected loopback server');
  return { server, url: `http://127.0.0.1:${address.port}` };
}

export async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
}

export function request(base: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${base}${path}`, { ...init, signal: AbortSignal.timeout(5000) });
}
