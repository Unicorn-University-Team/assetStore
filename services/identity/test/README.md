# AUTH-3: authentication and role checks

Run from the repository root using Node.js 24 and npm:

```bash
npm ci
npm test
npm run test:auth3
npm run typecheck:auth3
npm run typecheck
npm run build
```

`npm ci` builds the shared package and generates each service's Prisma client.
No migrations, `.env`, database, Docker, AWS credentials, or existing account are
needed. Tests bind two Express servers to random ports on `127.0.0.1`; local TCP
sockets must be permitted. To select a scenario independently:

```bash
npm run test:auth3 -- -t TC-06
```

`npm test` runs workspace tests, including AUTH-3 in identity and catalog's
Node tests and US-2/US-9 Vitest suites. Identity's `npm test` typechecks AUTH-3
and runs `services/identity/test/*.spec.ts` with the shared root Vitest config.
CI's Service (identity) job invokes this command, so AUTH-3 failures block Backend.
`npm run test:auth3` runs only AUTH-3; Vitest is a shared root devDependency.

## Actual implementation and coverage

The real Express apps, routes, controllers, models, cookie parser, Argon2 password
verification and JWT signing/verification run. Neither `requireAuth` nor
`requireRole` is mocked. Test-only environment and Prisma modules replace external
infrastructure, and a storage double replaces S3. Unexpected protected writes
throw as well as being recorded by spies. Fake user reads honor field selection;
registration supplies the schema's default USER role. These doubles do not prove
PostgreSQL constraints, durability, transactions or AWS behavior.

| Case | Coverage |
| --- | --- |
| TC-01 | Guests get anonymous 200 on GET `/api/auth/me` and JSON 401 on POST `/api/assets`, PUT `/api/assets/:id`, DELETE `/api/assets/:id` |
| TC-02 | USER and ADMIN log in through POST `/api/auth/login`, receive HttpOnly cookies, and get their own data through GET `/api/auth/me` (200) |
| TC-03 | Real auth-to-ADMIN-role middleware chain returns 403 for a valid USER token; report endpoint coverage is not included |
| TC-04 | Real auth-to-ADMIN-role middleware chain calls the protected-operation spy exactly once for ADMIN; report endpoint coverage is not included |
| TC-05 | Malformed JWTs, signed unsupported roles and invalid subjects get 401 on catalog writes and `/api/auth/me` |
| TC-06 | An RS256 JWT with expiration fixed in the past gets 401 on catalog writes and `/api/auth/me` |
| TC-07 | Catalog writes require an access cookie; `/me` returns anonymous 200 without session cookies or with an empty access cookie, and 401 with only a refresh cookie; Bearer-only `/me` is anonymous |
| TC-08 | Guests get 200 on GET `/api/assets`, GET `/api/assets/:id`, GET `/api/assets/:id/download` |
| TC-09 | Payload role tampering, unsigned tokens and tokens signed with an untrusted key get 401 on all protected routes; client role hints cannot bypass the real ADMIN gate (403); login and registration ignore supplied ADMIN roles |
| TC-10 | Every denied HTTP request leaves users/assets/sessions unchanged and invokes no database/storage operation; denied middleware calls never execute the protected-operation spy |

There are **54 passing tests and 2 explicitly skipped tests** in the validated suite.
The skips are TC-03 and TC-04 **HTTP endpoint** scenarios, with reasons in their
test names. Passing middleware tests do not substitute for endpoint tests.
The middleware ADMIN success test verifies delegation, not an HTTP 200 response or
an implemented administrative operation.

Fixtures use fixed valid UUIDs and a fresh in-memory dataset per test. RSA key pairs
are generated in memory; no private keys or tokens are written to disk. Valid JWTs
expire relative to execution time; expired fixtures use a fixed past timestamp.
Each rejected request checks both state snapshots and every infrastructure spy.
The suite creates no application routes.

## Coverage limitations and findings

- Community's implemented admin report routes are outside the HTTP coverage in
  this suite. TC-03 and TC-04 endpoint scenarios remain skipped; their middleware
  scenarios are covered directly.
- `requireRole('ADMIN')` itself is implemented and distinguishes an authenticated
  USER (403) from ADMIN (delegates). Authentication runs first in the unit chain,
  so a guest gets 401. These are direct middleware tests without invented routes.
- Catalog ownership rules have separate coverage; these tests exercise unauthenticated writes.
- Login's documented suspended-account 403 is an account-status rule rather than
  an administrator-role rule and is not used to stand in for TC-03.
- Browser behavior, gateway routing, token refresh/revocation, production key
  configuration and real infrastructure are outside this suite. Backend builds
  and typechecks passed; deployment and database integration were not exercised.

All changes are test files, test configuration, root scripts and development
dependency metadata. No production source or infrastructure is changed.
