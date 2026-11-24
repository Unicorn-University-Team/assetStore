# US-10 test report

Date: 2026-11-24. Objective: verify server-side collection creation, required name,
ownership and privacy against US-10 and the repository's collection contract.

## Baseline and preconditions

- Integration branch: `main` (remote default and CI integration/deployment branch).
  Fetched `origin` and created `test/us-10-collection-visibility` from
  `origin/main` at `ef7adb0`. The initial changes were subsequently committed by
  the user; the agent has performed no commits, merges or pushes.
- Original branch: `test/auth-3-role-checks`. Its committed work stays there;
  the pre-existing untracked `.idea/` directory is preserved and excluded from this change.
- Executed with Node.js 24.15.0, npm 11.12.1 and Vitest 5.1.1.
  Existing dependencies, shared build and generated Prisma clients were available.
- Two isolated UUID users (A/B), both initially `ACTIVE` and `USER`, with
  `@us10.example.test` addresses and the existing test-only password fixture.
  Both log in through the real identity API; `/api/auth/me` verifies their cookies.
  RSA keys are generated in memory by the reused US-9 fixture.
- Real community/identity apps, routes, models, controllers, cookie parsing,
  password verification and JWT verification execute on random loopback ports.
  PostgreSQL modules and environment configuration are replaced by test doubles;
  identity status lookup reads the isolated user fixture. No live accounts,
  database, AWS credentials, Docker or `.env` are required or modified.
- State is reset before each case and cleared afterward; servers close after the suite.
  Reuses `services/catalog/test/helpers/http.ts` and `helpers/test-data.ts`.

## Contract inspected

Sources: README section **Kolekce**, Postman **Collections**, community collection
routes/controller/model, Prisma schema/migrations, shared `requireAuth`, identity
login and community `IdentityClient.status`.

Only `POST /api/collections` and `GET /api/collections` exist. Creation returns
201; own list returns 200 with `{ itemList }`. Name is trimmed and required,
1–100 characters; description is trimmed, optional and limited to 2000 characters.
Invalid values return 400; unauthenticated collection requests return 401.
Owner comes from the verified access cookie. No collection detail route exists.
Frontend has neither collection UI nor an existing frontend test runner, so no
frontend tests or additional framework were added.

## Executed results

| Case | Expected | Actual | Status |
| --- | --- | --- | --- |
| TC-US10-01 valid collection | 201; A owns it; empty; present in A's list | 201; correct scalar fields/owner and list; no nested or separate asset-link writes | PASS* |
| TC-US10-02 no description | 201 with optional description omitted | 201; stored/returned description is empty string; present in list | PASS |
| TC-US10-03 missing name | 400; no new collection | 400 with validation error; store unchanged; no create call | PASS |
| TC-US10-04 empty name | 400; no new collection | 400 with validation error; store unchanged; no create call | PASS |
| TC-US10-05 owner list | 200; A sees A's collection only | Exact own list returned with B's collection also in storage | PASS |
| TC-US10-05 owner details | Owner can retrieve details through an implemented API | No detail route or documented detail API; explicit skipped test | NOT EXECUTED |
| TC-US10-06 other user | B cannot list/read A's collection | B sees only B's collection; direct ID URL probe returns generic route 404 without collection data | PASS** |
| TC-US10-07 guest | Guest receives no private collection data | Both collection list and direct ID probe return 401; no list query | PASS** |
| TC-US10-08 guest creation | 401; no new collection | 401; existing store/list unchanged; no create call | PASS |
| TC-US10-09 whitespace name | 400; no new collection | Spaces, tab and newline rejected; no write | PASS |
| TC-US10-10 boundaries (2 variants) | Trimmed name lengths 1/100 and description length 2000 accepted | Both return 201 with exact trimmed values | PASS |
| TC-US10-11 name length 101 | 400; no new collection | 400; unchanged store and no create call | PASS |
| TC-US10-12 description length 2001 | 400; no new collection | 400; unchanged store and no create call | PASS |
| TC-US10-13 suspended after login | Reject creation with a client error; no write | **201; collection created; known DEF-US10-01 tracked with `it.fails`** | FAIL (expected) |
| TC-US10-14 supplied ownerId=B | Authenticated A remains owner | 201; A owns stored/returned collection; invisible in B's list | PASS |

Latest US-10 runner totals: **14 passed, 1 expected fail, 1 skipped (16 tests)**.
The runner exits successfully; the expected failure is an unresolved business
requirement defect, not a passing acceptance scenario.
The full TC-US10-05 remains incomplete because owner detail access is unavailable.

*Empty content is checked at the persistence boundary: creation passes only
`ownerId`, `name`, `description` to Prisma, without nested relation writes, and
does not insert asset links separately. These mocked-infrastructure tests do not
verify real PostgreSQL relation state, constraints, triggers or durability.

**The direct ID URL is a negative probe, not an invented detail API. B's 404
comes from the generic missing-route handler after authentication. It establishes
absence of data exposure today, not ownership authorization for a working detail
endpoint. That authorization must be tested when a detail route is implemented.

## Defects and gaps

**DEF-US10-01 — Suspended account can create collections with an existing token.**
Reproduce: log in as active A, change A's account status to `SUSPENDED`, then
POST `{ "name": "Suspended attempt" }` using the previously issued cookie.
Expected under US-10: rejection and no collection write. Actual: 201 and a new
row in the persistence double. Collection routes use JWT-only `requireAuth`;
neither the middleware nor collection creation checks current account status.
Identity login itself rejects suspended users, which does not prevent reuse of
an already-issued token. Test asserts a 4xx rejection without inventing an exact
collection-specific status code. Production code is unchanged. The regression
test now uses Vitest's `it.fails` to track this documented defect without failing
the entire suite. The required rejection/no-write assertions remain in place;
the test is executed, not skipped. Once the backend meets these assertions,
Vitest reports an unexpected pass as a failure: remove `.fails` after fixing
the backend. Ordinary assertions replace `expect.soft` because soft assertions
are unsupported inside `it.fails`.

**GAP-US10-02 — Owner detail retrieval unavailable.** Neither README nor router
defines a collection detail endpoint. The requested owner detail scenario is
explicitly skipped, and this gap is not treated as a privacy leak.

## Execution and reproduction

From the repository root, with Node.js 24 and local TCP sockets permitted:

```bash
npm ci
npm test
npm run test:us10 -w @assetstore/community
npm run test:us10 -w @assetstore/community -- -t TC-US10-13
npm run typecheck:tests -w @assetstore/community
npm run typecheck:tests -w @assetstore/catalog
npm run typecheck
npm run build -w @assetstore/community
```

`npm ci` is the clean-checkout setup command; it was not rerun in this prepared
workspace. It builds shared code and generates Prisma clients, without migrations.

Latest rerun after marking DEF-US10-01 as an expected failure: `npm test` ran
all 7 existing tag tests and all 21 existing US-2/US-9 HTTP tests successfully,
then US-10 with the results above. Overall exit code: **0**. Community test
typecheck (included in `npm test`) passed again. The original run exited 1
because of DEF-US10-01 before it was marked as expected. Catalog test typecheck,
all workspace production typechecks, and community build passed during the
initial implementation; those checks were not repeated for this test-only edit.

The first sandboxed HTTP run was blocked by `listen EPERM` on `127.0.0.1`.
The full test command was rerun successfully outside that socket restriction;
the table records that executed rerun, not the initially skipped tests.
Real database/deployment/browser testing was not executed.

## Changed files

- `services/community/test/us-10-collection-visibility.spec.ts` — new API tests.
- `services/community/test/helpers/us10-data.ts` — isolated community persistence/status doubles.
- `services/community/tsconfig.test.json` — test typecheck configuration following catalog conventions.
- `services/community/package.json` — test/typecheck scripts; existing root workspace runner and CI now include US-10.
- `US10_TEST_REPORT.md` — this report.

No production logic or dependencies were changed. This follow-up modifies only
the US-10 test and this report; those edits remain uncommitted on
`test/us-10-collection-visibility`. `.idea/` remains untracked and untouched.
