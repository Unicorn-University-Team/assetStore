# US-9: Asset download

Run from the repository root in PyCharm's terminal, using Node.js 24 and npm:

```bash
npm ci
npm run test:us9 -w @assetstore/catalog
npm run typecheck:tests -w @assetstore/catalog
npm run typecheck
npm run build
```

`npm ci` also builds the shared package and generates the Prisma clients for all
services. It does not run migrations. No `.env`, database, Docker, AWS credentials,
or existing user account is needed for these tests. The two test servers bind to
random ports on `127.0.0.1` and close after the suite. Local TCP sockets must be
allowed. All other test I/O is in memory.

To run a single scenario independently:

```bash
npm run test:us9 -w @assetstore/catalog -- -t TC-04
```

`npm test -w @assetstore/catalog` runs all catalog tests. Vitest is the only new
test dependency: the repository had no automated TypeScript test framework, and
Vitest supplies TypeScript support and module mocks without production changes.
Node's built-in `fetch` sends requests; no HTTP test client dependency is needed.

| Case | Assertions |
| --- | --- |
| TC-01 | Guest download without cookies: HTTP 200 and exact fixture bytes |
| TC-02 | Real login, HttpOnly cookies, authenticated `/api/auth/me`, then download: HTTP 200 and exact bytes |
| TC-03 | Guest: read count, download, read count; exactly +1 |
| TC-04 | Registered user: log in, read count, download, read count; exactly +1 |
| TC-05 | Three downloads, for both guest and registered user: exactly +3 |
| TC-06 | Malformed ID and unknown UUID: HTTP 404, `{ "error": "Asset not found" }`, no S3 read or counter write |
| TC-07 | Exact file bytes, attachment filename, Content-Length and `nosniff` |

There are nine tests because TC-05 and TC-06 each have two variants. Every test
gets a new UUID asset and active USER account. The counter starts at 7 to catch
accidental resetting. Read requests must not change it. The `.obj` fixture is
served in two chunks to exercise streaming, and S3 requests must use its exact
private object key and test bucket.

The real catalog and identity Express apps, routes, controllers, models, views,
Argon2 password verification, JWT signing/verification, cookie parsing, S3 storage
adapter and response streaming execute. Test-only module mocks replace both
Prisma connection modules and environment configs. The S3 client's `send` method
is intercepted before its transport; unexpected S3 operations fail the test.
RSA keys are generated in memory for each suite. No stored credentials are used.

Counter checks inspect both the HTTP asset view and the row retained in the
in-memory Prisma double, and assert the real model sends an atomic increment of
1 per download. These are HTTP integration tests with mocked external services:
they do not prove PostgreSQL durability/concurrency or S3 permissions and network
behavior. The identity session write is also mocked. Browser, gateway and refresh
flows are outside this suite. It is not necessary to start the frontend.

The current Asset schema has no publication status: an existing asset is directly
downloadable. Both guest and registered downloads use the public route, which does
not require or validate a cookie. The registered tests prove that a valid session
was issued and sent; the identity `/me` check exercises authentication separately.
Failed or interrupted streams are outside the requested cases; the implementation
increments before the stream finishes, so these tests do not establish whether
only fully delivered downloads are counted.
