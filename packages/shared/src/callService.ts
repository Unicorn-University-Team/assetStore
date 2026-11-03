import { HttpError } from './HttpError';
import { INTERNAL_KEY_HEADER } from './internalKey';

export interface CallServiceOptions {
  // Shared secret of the services (env.internalKey), sent in the X-Internal-Key header.
  internalKey: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  // Sent as JSON.
  body?: unknown;
  // A service that does not answer in time counts as unavailable, so it cannot hang the caller.
  timeoutMs?: number;
}

// Calls another service directly inside the Docker network, e.g.
//   const { exists } = await callService<{ exists: boolean }>(env.catalogUrl, `/internal/assets/${id}/exists`,
//     { internalKey: env.internalKey });
// Returns the JSON answer. If the service is down, too slow or answers with an error, throws HttpError
// 503 / 502: the error handler then answers the client clearly instead of with a generic 500.
export async function callService<T>(baseUrl: string, path: string, options: CallServiceOptions): Promise<T> {
  const url = baseUrl.replace(/\/+$/, '') + path;
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { [INTERNAL_KEY_HEADER]: options.internalKey };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(options.timeoutMs ?? 3000),
    });
  } catch (error) {
    // The service is not running, its address is wrong, or it did not answer within the timeout.
    console.error(`${method} ${url} failed:`, error);
    throw new HttpError(503, 'A required service is unavailable, try again later');
  }

  if (!response.ok) {
    console.error(`${method} ${url} answered ${response.status}: ${await response.text()}`);
    throw new HttpError(502, 'A required service answered with an error');
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
