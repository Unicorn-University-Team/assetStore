import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { requireAuth } from '../../../packages/shared/src/auth/requireAuth';
import { requireRole } from '../../../packages/shared/src/auth/requireRole';
import { ids, publicKey, token } from './helpers/fixtures';

// Direct middleware invocation, not an invented application endpoint.
// Both production middleware functions run; next represents a protected operation.
async function run(accessToken?: string, clientHints = false) {
  const state = { writes: 0 };
  const req = {
    cookies: { ...(accessToken === undefined ? {} : { access_token: accessToken }), ...(clientHints ? { role: 'ADMIN' } : {}) },
    body: clientHints ? { role: 'ADMIN', isAdmin: true } : {},
    headers: clientHints ? { 'x-role': 'ADMIN' } : {}, query: clientHints ? { role: 'ADMIN' } : {},
  } as unknown as Request;
  const res = {
    locals: {}, status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const operation = vi.fn(() => { state.writes += 1; });
  const roleGate = requireRole('ADMIN');
  const authNext = vi.fn(() => roleGate(req, res, operation));
  await requireAuth(() => publicKey)(req, res, authNext);
  return { res, operation, authNext, state };
}

describe('AUTH-3: real authentication and ADMIN role middleware chain (unit tests)', () => {
  it('TC-01 / TC-10: guest gets 401 before role checking and cannot execute the operation', async () => {
    const result = await run();
    expect(result.res.status).toHaveBeenCalledWith(401);
    expect(result.res.json).toHaveBeenCalledWith({ error: 'Authentication required.' });
    expect(result.authNext).not.toHaveBeenCalled();
    expect(result.operation).not.toHaveBeenCalled();
    expect(result.state.writes).toBe(0);
  });

  it('TC-03 / TC-10: authenticated USER gets 403 and cannot execute the operation', async () => {
    const result = await run(await token());
    expect(result.res.locals).toMatchObject({ userId: ids.USER, role: 'USER' });
    expect(result.authNext).toHaveBeenCalledOnce();
    expect(result.res.status).toHaveBeenCalledExactlyOnceWith(403);
    expect(result.res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    expect(result.operation).not.toHaveBeenCalled();
    expect(result.state.writes).toBe(0);
  });

  it('TC-04: authenticated ADMIN passes the ADMIN gate and executes the operation once', async () => {
    const result = await run(await token({ role: 'ADMIN', sub: ids.ADMIN }));
    expect(result.res.locals).toMatchObject({ userId: ids.ADMIN, role: 'ADMIN' });
    expect(result.res.status).not.toHaveBeenCalled();
    expect(result.res.json).not.toHaveBeenCalled();
    expect(result.operation).toHaveBeenCalledOnce();
    expect(result.state.writes).toBe(1);
  });

  it('TC-09 / TC-10: USER cannot bypass the ADMIN gate using client role hints', async () => {
    const result = await run(await token(), true);
    expect(result.res.locals.role).toBe('USER');
    expect(result.res.status).toHaveBeenCalledWith(403);
    expect(result.res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    expect(result.operation).not.toHaveBeenCalled();
    expect(result.state.writes).toBe(0);
  });

  it('TC-05 / TC-10: invalid token gets 401 rather than reaching the ADMIN gate', async () => {
    const result = await run('invalid.jwt.value');
    expect(result.res.status).toHaveBeenCalledWith(401);
    expect(result.authNext).not.toHaveBeenCalled();
    expect(result.operation).not.toHaveBeenCalled();
    expect(result.state.writes).toBe(0);
  });
});
