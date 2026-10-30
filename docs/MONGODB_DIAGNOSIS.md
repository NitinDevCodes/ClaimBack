# Atlas connection investigation — 31 October 2026

## Confirmed root causes

1. **DNS discovery failed before authentication.** Node's default configured resolver returned `ECONNREFUSED` for the Atlas SRV lookup. Independent process-local queries to Cloudflare and Google DNS both resolved three Atlas SRV targets and the cluster TXT record. The exact same credentials then connected successfully with those explicit resolvers. This establishes a failure on the default DNS resolution path; it does not establish whether the underlying cause is the OS resolver, network equipment, ISP, or a Node resolver interaction.
2. **The URI omitted the database name.** The driver selected `test`. The ignored local URI was updated to select `/claimback`, preserving the supplied cluster hostname, username and password.

## Environment audit

- The backend expects `server/.env`, resolved from `server/src/config/env.js` using an absolute module-relative path. It does not load a root `.env` for backend configuration.
- The file exists in the correct location and contains one `MONGODB_URI` definition.
- No alternate MongoDB variable name, duplicate definition, inherited `MONGODB_URI` override, surrounding whitespace, placeholder credential, or invalid percent escape was detected.
- dotenv executes before `parseEnv()` and before database initialization.
- The connection uses `mongodb+srv` and the supplied Atlas hostname; no local/test database fallback is configured.
- The backend watcher watches source files, so a backend restart is needed after editing `.env`.
- No URI, database username, password, session cookie value or other secret was printed during the investigation.

## Fix

- Added optional, validated `MONGODB_DNS_SERVERS`. The local ignored `.env` explicitly sets `1.1.1.1,8.8.8.8`; the example defaults to blank so other environments retain their normal resolver.
- Applied this setting before Mongoose connects. It affects Node DNS resolution in this backend process only, not Windows DNS settings. TLS and hostname validation remain enabled.
- Set the local URI database path to `/claimback`.
- Added safe structured failure classification for URI parsing, authentication, authorization, DNS, TLS, network reachability and initialization errors. Logs contain static advice and safe error codes, not raw driver messages or connection strings. Network timeouts are not falsely reported as proven IP-access-list failures.
- If development initialization fails after a socket opens (for example, index creation fails), the backend now disconnects so readiness cannot report a successful connection after incomplete initialization.
- Restarted the development services using the existing root `npm run dev` command.

## Atlas checks

- The configured hostname resolved to Atlas nodes and accepted the configured database credentials.
- An independent connection could read from `claimback.users`; the application's users collection and unique email index initialized successfully.
- Authentication reported the database user has **atlasAdmin** on `admin`. It has sufficient permissions but is broader than an application needs. A dedicated application user with `readWrite` on `claimback` is preferable. No Atlas roles were changed.
- The existing network path and Atlas access rules permit the verified connection. The Atlas project's access-list entries were not independently inspected in the console; no access rule was added or widened.
- No authentication, password-encoding, TLS, cluster-hostname resolution, or IP-blocking failure remained after the DNS correction. The Atlas cluster display name was not independently inspected; the connection used the hostname supplied in the user's configuration.

## Verification results

| Check | Result |
| --- | --- |
| Application connection code | Connected to real Atlas, database `claimback` |
| Users unique email index | Present |
| Backend `/api/v1/health` | HTTP 200, `database: connected` |
| Backend `/api/v1/health/ready` | HTTP 200 |
| Vite `/api/v1/health` proxy | HTTP 200, `database: connected` |
| Browser service-status page | API Operational; Database Connected |
| Registration through the running Vite proxy | HTTP 201 |
| Login and authenticated `/auth/me` | HTTP 200 |
| Cookie checks | HTTP-only, SameSite=Lax, restricted `/api/v1` path |
| Independent Atlas read | Created account found in `claimback.users`; password stored as a hash |
| Logout and reuse of old cookie | Logout 200; revoked session 401 |
| Verification-data cleanup | Exactly one uniquely generated test account removed |
| Backend regression suite | 25 passed, 0 failed |

The live verification used the actual configured Atlas cluster, not `mongodb-memory-server`. The separate automated regression suite uses isolated temporary MongoDB as before. No frontend code or dependencies changed; the frontend production build had already passed during the foundation recheck.

Both development servers were left running. They still need to be started again after Windows restarts. Runtime output is in the ignored root `dev.stdout.log` and `dev.stderr.log` files.

## Changed files

- `server/.env` (ignored): database path and explicit resolver setting; credentials preserved.
- `server/.env.example`: documents the optional resolver setting.
- `server/src/config/env.js`: parses and validates resolver IP addresses.
- `server/src/config/database.js`: applies the explicit process-local resolver setting before connection.
- `server/src/server.js`: logs safe diagnostic classifications and disconnects after failed initialization.
- `server/src/utils/databaseDiagnostics.js`: safe driver-error classification.
- `server/test/databaseDiagnostics.test.js`: five diagnostic/redaction/configuration tests.
- `README.md`, `docs/VERIFICATION.md`, this file: setup and verification documentation.

## References

- [MongoDB Atlas connection troubleshooting](https://www.mongodb.com/docs/atlas/troubleshoot-connection/) describes SRV lookup failures and the use of DNS resolvers that support them.
- [Mongoose FAQ](https://mongoosejs.com/docs/faq.html) documents `querySrv ECONNREFUSED` on Windows and explicit Node DNS configuration.
