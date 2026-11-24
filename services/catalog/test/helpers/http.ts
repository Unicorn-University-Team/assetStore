import type { Express } from 'express';
import type { Server } from 'node:http';

export async function serve(app: Express): Promise<{ server: Server; url: string }> {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a loopback TCP server');
  return { server, url: `http://127.0.0.1:${address.port}` };
}

export async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
}

export function request(baseUrl: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${baseUrl}${path}`, { ...init, signal: AbortSignal.timeout(5_000) });
}
