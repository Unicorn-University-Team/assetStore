# AUTH-3: authentication and role checks

Run from this worktree's root in PyCharm's terminal using Node.js 24 and npm:

```bash
cd /Users/natalia/Desktop/assetStore
npm ci
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

Vitest is a root development dependency because this suite spans shared middleware,
identity and catalog. Local `main` had no test framework. No US-9 changes are
included in this branch. Node's built-in `fetch` sends HTTP requests.

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
| TC-01 | Guests get JSON 401 on GET `/api/auth/me`, POST `/api/assets`, PUT `/api/assets/:id`, DELETE `/api/assets/:id` |
| TC-02 | USER and ADMIN log in through POST `/api/auth/login`, receive HttpOnly cookies, and get their own data through GET `/api/auth/me` (200) |
| TC-03 | Real auth-to-ADMIN-role middleware chain returns 403 for a valid USER token; endpoint coverage is blocked |
| TC-04 | Real auth-to-ADMIN-role middleware chain calls the protected-operation spy exactly once for ADMIN; endpoint coverage is blocked |
| TC-05 | Malformed JWTs, signed unsupported roles and invalid subjects get 401 on all four protected routes |
| TC-06 | An RS256 JWT with expiration fixed in the past gets 401 on all four protected routes |
| TC-07 | Missing, empty and unrelated cookies get 401; a valid ADMIN Bearer token alone also gets 401 |
| TC-08 | Guests get 200 on GET `/api/assets`, GET `/api/assets/:id`, GET `/api/assets/:id/download` |
| TC-09 | Payload role tampering, unsigned tokens and tokens signed with an untrusted key get 401 on all protected routes; client role hints cannot bypass the real ADMIN gate (403); login and registration ignore supplied ADMIN roles |
| TC-10 | Every denied HTTP request leaves users/assets/sessions unchanged and invokes no database/storage operation; denied middleware calls never execute the protected-operation spy |

There are **53 passing tests and 2 explicitly skipped tests** in the validated suite.
The skips are TC-03 and TC-04 **HTTP endpoint** scenarios, with reasons in their
test names. Passing middleware tests do not substitute for missing endpoint tests.
The middleware ADMIN success test verifies delegation, not an HTTP 200 response or
an implemented administrative operation.

Fixtures use fixed valid UUIDs and a fresh in-memory dataset per test. RSA key pairs
are generated in memory; no private keys or tokens are written to disk. Valid JWTs
expire relative to execution time; expired fixtures use a fixed past timestamp.
Each rejected request checks both state snapshots and every infrastructure spy.
The suite creates no application routes.

## Coverage limitations and findings

- No existing route uses `requireRole`. The identity router only implements
  register/login/me/refresh/logout; planned `/api/users` administrative operations
  do not exist. Consequently, no implemented administrator-only endpoint can be
  asserted to return HTTP 403 for USER or to succeed for ADMIN. The two endpoint
  scenarios remain skipped until the corresponding functionality is implemented.
- `requireRole('ADMIN')` itself is implemented and distinguishes an authenticated
  USER (403) from ADMIN (delegates). Authentication runs first in the unit chain,
  so a guest gets 401. These are direct middleware tests without invented routes.
- Catalog writes currently require authentication only. Asset ownership is not
  implemented (README explicitly documents this, and Asset has no ownerId). These
  tests do not assume USER edits are restricted to the owner's assets.
- Community has no implemented public business routes or role restrictions; its
  internal shared-key check is separate from cookie-based AUTH-3 and is out of scope.
- Login's documented suspended-account 403 is an account-status rule rather than
  an administrator-role rule and is not used to stand in for TC-03.
- No authorization defect was exposed by the executable scenarios. The absence
  of endpoint role enforcement is reported as missing functionality, not silently
  repaired or represented by passing endpoint tests.
- Browser behavior, gateway routing, token refresh/revocation, production key
  configuration and real infrastructure are outside this suite. Backend builds
  and typechecks passed; deployment and database integration were not exercised.

All changes are test files, test configuration, root scripts and development
dependency metadata. No production source or infrastructure is changed.
