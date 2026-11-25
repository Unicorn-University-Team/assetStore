import * as argon2 from 'argon2';
import { decodeJwt, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { close, request, serve } from './helpers/http';
import {
  assets, cookie, ids, identityDb, infrastructureSpies, password,
  resetData, snapshot, token, users,
} from './helpers/fixtures';

vi.mock('../src/config/env', async () => ({ env: (await import('./helpers/fixtures.js')).testEnv }));
vi.mock('../../catalog/src/config/env', async () => ({ env: (await import('./helpers/fixtures.js')).testEnv }));
vi.mock('../src/db/prisma', async () => ({ prisma: (await import('./helpers/fixtures.js')).identityDb }));
vi.mock('../../catalog/src/db/prisma', async () => ({ prisma: (await import('./helpers/fixtures.js')).catalogDb }));
vi.mock('../../catalog/src/storage/file-storage', async () => ({ FileStorage: (await import('./helpers/fixtures.js')).storage }));

import { app as identityApp } from '../src/app';
import { app as catalogApp } from '../../catalog/src/app';

const protectedRoutes = [
  { service: 'identity', method: 'GET', path: '/api/auth/me' },
  { service: 'catalog', method: 'POST', path: '/api/assets' },
  { service: 'catalog', method: 'PUT', path: `/api/assets/${ids.asset}` },
  { service: 'catalog', method: 'DELETE', path: `/api/assets/${ids.asset}` },
] as const;
const deniedCases = [
  ['TC-01', 'guest', 'Authentication required.'],
  ['TC-07', 'unrelated-cookie', 'Authentication required.'],
  ['TC-07', 'empty-cookie', 'Authentication required.'],
  ['TC-05', 'malformed', 'Invalid or expired token.'],
  ['TC-06', 'expired', 'Invalid or expired token.'],
  ['TC-09', 'tampered-role', 'Invalid or expired token.'],
  ['TC-09', 'unsigned', 'Invalid or expired token.'],
  ['TC-09', 'untrusted-key', 'Invalid or expired token.'],
  ['TC-05', 'invalid-role', 'Invalid token role.'],
  ['TC-05', 'invalid-subject', 'Invalid token.'],
] as const;

describe('AUTH-3: existing HTTP routes', () => {
  let identity: Awaited<ReturnType<typeof serve>>;
  let catalog: Awaited<ReturnType<typeof serve>>;
  let passwordHash: string;
  const authCookies: Record<string, string> = {};

  beforeAll(async () => {
    passwordHash = await argon2.hash(password);
    const signed = await token();
    const parts = signed.split('.');
    parts[1] = Buffer.from(JSON.stringify({ ...decodeJwt(signed), role: 'ADMIN' })).toString('base64url');
    const attacker = await generateKeyPair('RS256');
    const untrusted = await new SignJWT({ role: 'ADMIN' }).setProtectedHeader({ alg: 'RS256' })
      .setSubject(ids.USER).setExpirationTime('1h').sign(attacker.privateKey);
    Object.assign(authCookies, {
      guest: '', 'unrelated-cookie': 'role=ADMIN; refresh_token=not-an-access-token',
      'empty-cookie': 'access_token=', malformed: cookie('not.a.jwt'),
      expired: cookie(await token({}, true)), 'tampered-role': cookie(parts.join('.')),
      unsigned: cookie(`${Buffer.from('{"alg":"none"}').toString('base64url')}.${parts[1]}.`),
      'untrusted-key': cookie(untrusted), 'invalid-role': cookie(await token({ role: 'SUPERADMIN' })),
      'invalid-subject': cookie(await token({ sub: 'not-a-uuid' })),
    });
    identity = await serve(identityApp);
    catalog = await serve(catalogApp);
  });

  afterAll(async () => {
    await Promise.all([identity && close(identity.server), catalog && close(catalog.server)]);
  });
  beforeEach(() => resetData(passwordHash));

  for (const route of protectedRoutes) {
    describe(`${route.method} ${route.path}`, () => {
      it.each(deniedCases)('%s / TC-10: %s follows session policy without infrastructure calls or data changes', async (_tc, kind, error) => {
        const anonymousMe = route.service === 'identity' && (kind === 'guest' || kind === 'empty-cookie');
        const before = snapshot();
        const response = await request(route.service === 'identity' ? identity.url : catalog.url, route.path, {
          method: route.method,
          headers: { Cookie: authCookies[kind] ?? '', 'Content-Type': 'application/json' },
          // Valid JSON ensures the request reaches authentication rather than JSON parser errors.
          ...(route.method === 'POST' || route.method === 'PUT' ? { body: JSON.stringify({ name: 'Denied change', description: '' }) } : {}),
        });
        expect(response.status).toBe(anonymousMe ? 200 : 401);
        expect(response.headers.get('content-type')).toContain('application/json');
        expect(await response.json()).toEqual(anonymousMe ? { user: null } : { error });
        expect(response.headers.getSetCookie()).toEqual([]);
        expect(snapshot()).toEqual(before);
        for (const operation of infrastructureSpies()) expect(operation).not.toHaveBeenCalled();
      });
    });
  }

  async function login(role: 'USER' | 'ADMIN', extra = {}): Promise<string> {
    const response = await request(identity.url, '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `${role.toLowerCase()}@auth3.example.test`, password, ...extra }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: 'Login successful.' });
    const setCookies = response.headers.getSetCookie();
    expect(setCookies).toHaveLength(2);
    expect(setCookies).toEqual(expect.arrayContaining([
      expect.stringMatching(/^access_token=.+;.*HttpOnly/), expect.stringMatching(/^refresh_token=.+;.*HttpOnly/),
    ]));
    return setCookies.map((value) => value.split(';')[0]).join('; ');
  }

  it.each(['USER', 'ADMIN'] as const)('TC-02: %s logs in and accesses its own data (200)', async (role) => {
    const sessionCookie = await login(role);
    const response = await request(identity.url, '/api/auth/me', { headers: { Cookie: sessionCookie } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: {
      id: ids[role], username: `auth3-${role.toLowerCase()}`, email: `${role.toLowerCase()}@auth3.example.test`, role, status: 'ACTIVE',
      confirmedViolations: 0, suspendedAt: null,
    } });
    expect(identityDb.session.create).toHaveBeenCalledTimes(1);
  });

  it('TC-09: login ignores a USER-supplied ADMIN role; cookie/header/body/query hints do not change the session role', async () => {
    const sessionCookie = await login('USER', { role: 'ADMIN', isAdmin: true });
    const userBefore = structuredClone([...users]);
    const response = await request(identity.url, `/api/auth/me?role=ADMIN&userId=${ids.ADMIN}`, {
      headers: { Cookie: `${sessionCookie}; role=ADMIN; isAdmin=true`, 'X-Role': 'ADMIN', 'X-User-Id': ids.ADMIN,
        Authorization: `Bearer ${await token({ role: 'ADMIN', sub: ids.ADMIN })}` },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ user: { id: ids.USER, role: 'USER' } });
    expect([...users]).toEqual(userBefore);
    expect(identityDb.user.update).not.toHaveBeenCalled();
  });

  it('TC-09: registration ignores role=ADMIN and persists a USER account', async () => {
    const response = await request(identity.url, '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'auth3-new-user', email: 'new@auth3.example.test', password, role: 'ADMIN', isAdmin: true }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ id: ids.registered });
    expect(identityDb.user.create).toHaveBeenCalledExactlyOnceWith({ data: {
      username: 'auth3-new-user', email: 'new@auth3.example.test', passwordHash: expect.any(String),
    } });
    const created = users.get(ids.registered);
    expect(created?.role).toBe('USER');
    expect(await argon2.verify(created!.passwordHash, password)).toBe(true);
  });

  it('registration rejects an existing username with different capitalization', async () => {
    const response = await request(identity.url, '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'AUTH3-USER', email: 'new@auth3.example.test', password }),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'This username already exists.' });
    expect(identityDb.user.create).not.toHaveBeenCalled();
    expect(users.size).toBe(2);
  });

  it('TC-07 / TC-09: an ADMIN Bearer token alone leaves /me anonymous (200)', async () => {
    const before = snapshot();
    const response = await request(identity.url, '/api/auth/me', {
      headers: { Authorization: `Bearer ${await token({ role: 'ADMIN', sub: ids.ADMIN })}` },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: null });
    expect(snapshot()).toEqual(before);
    for (const operation of infrastructureSpies()) expect(operation).not.toHaveBeenCalled();
  });

  it.each([
    ['/api/assets', 'list'], [`/api/assets/${ids.asset}`, 'details'], [`/api/assets/${ids.asset}/download`, 'download'],
  ])('TC-08: guests access %s (200)', async (path, kind) => {
    const response = await request(catalog.url, path!);
    expect(response.status).toBe(200);
    if (kind === 'download') {
      expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
      expect(assets.get(ids.asset)?.downloadCount).toBe(1);
    } else {
      const body = await response.json();
      expect(body).toMatchObject(kind === 'list' ? { itemList: [{ id: ids.asset }] } : { id: ids.asset });
    }
  });

  it.skip('TC-03: USER receives 403 on an admin-only endpoint — not yet covered by this HTTP suite');
  it.skip('TC-04: ADMIN completes an admin-only operation — not yet covered by this HTTP suite');
});
