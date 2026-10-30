# Foundation verification

Initial foundation verified on 30 October 2026. Development-environment recheck completed on 31 October 2026, in the supplied Windows workspace.

## Latest result: Atlas connected

The subsequent [MongoDB investigation](MONGODB_DIAGNOSIS.md) resolved the default-resolver SRV failure and corrected the URI database path to `claimback`. The live backend and Vite proxy now return `database: connected`, and readiness returns 200. Registration/login were verified against real Atlas and the inserted user was independently read from `claimback.users`; the disposable verification account was removed afterward. Regression tests now total **25 passed**. The disconnected-database results below describe the earlier foundation recheck, before this fix.

## Development-environment recheck

Scope: existing foundation only. No lost/found, Gemini or other new application features were added.

### Connection-refusal diagnosis

The previous work deliberately stopped the development servers before handing back the project. At the start of this investigation, neither port 5173 nor 5000 had a listener, and both URLs refused connections. Starting the existing root `npm run dev` command restored access. No missing dependency, broken import, wrong port, CORS misconfiguration, or proxy error was found to explain the refused connections.

The root command starts both workspaces through `concurrently`. Vite binds 127.0.0.1:5173 with strict port selection. Axios uses `/api/v1` with credentials enabled. Vite forwards `/api` to 127.0.0.1:5000. Both local frontend origins are explicitly allowed by the backend. Environment values were inspected without printing secrets: `MONGODB_URI` is empty, a persistent JWT secret is present, and development cookies use HTTP-only/SameSite=Lax.

### Repeated checks

| Check | Result |
| --- | --- |
| `npm ls --depth=0` | All declared dependencies present; one unused extraneous package (`is-stream`) does not affect execution |
| `npm test` | 20 passed, 0 failed, 0 skipped |
| `npm run build` | Passed |
| Frontend `/` | HTTP 200; landing page renders in the browser |
| Direct `/api/v1/health` | HTTP 200, database disconnected |
| Proxied `:5173/api/v1/health` | HTTP 200, same backend state |
| `/api/v1/health/ready` | HTTP 503, explicit database-unavailable error |
| Unknown API route | HTTP 404, consistent JSON error |
| CORS preflight from both allowed frontend origins | HTTP 204, exact origin and credentials allowed |
| CORS preflight from an untrusted origin | HTTP 403 |
| Main-app registration/login submissions | Reach Express through the proxy; show the real missing-database error |
| Browser JavaScript warning/error log checks | No entries returned during the checked flows |

### Successful authentication browser test

An isolated instance of the existing application ran on frontend port 5174/API port 5001 against an actual temporary MongoDB process supplied by the already-installed test dependency. Only process-local configuration was overridden; the real `.env` files and main servers were not changed. This was not an Atlas connection or mocked HTTP success.

- Visiting `/account` while signed out redirected to `/login`.
- Registration created a test user and opened the protected account page.
- Reloading the page retained the authenticated session, exercising the browser cookie and `/auth/me` request through Vite.
- Profile editing saved a changed name.
- Logout removed access to the account page.
- Logging in again retrieved the saved name.
- After a second logout, revisiting `/account` again redirected to `/login`.
- Existing integration tests independently verify HTTP-only/SameSite cookie attributes, expiration, invalid tokens, session revocation, role restrictions and suspended accounts.
- Screenshot evidence: [isolated browser authentication check](auth-browser-verification.png). The displayed account is disposable test data, not production content.

The isolated test services were stopped after verification. The main development servers were left running in a background process launched with the root `npm run dev` command. Their output is recorded in the ignored root `dev.stdout.log` and `dev.stderr.log` files. They are not configured to start after a machine reboot.

### Changes and remaining limitation

Only this verification record, the README's startup/troubleshooting instructions, and the browser evidence image were added/updated. Application modules, scripts, dependencies and environment files were preserved. Atlas remains unconfigured, so persistent real-account use requires `MONGODB_URI` and a backend restart. Expected 503 database errors were not suppressed.

## Automated checks

- `npm install`: completed; 324 packages installed; npm reported zero known vulnerabilities at installation time.
- `npm test`: **20 passed, 0 failed, 0 skipped**, against an isolated actual MongoDB process.
- `npm run build`: **passed**, producing `client/dist` with the React application and Tailwind CSS.
- Database initialization was corrected after integration tests exposed collection auto-creation before a connection existed with buffering disabled. Collection/index creation now occurs explicitly after connection.
- Initial MongoDB test startup failed inside the Windows sandbox. The same test command passed outside the sandbox after the initialization fix.

## Runtime checks

- `npm run dev`: both Express on port 5000 and Vite on port 5173 started successfully.
- Frontend HTTP request: **200**.
- `/api/v1/health`: **200**, API operational, database disconnected (no Atlas credentials supplied).
- `/api/v1/health/ready` and data endpoints return **503** when disconnected (covered in automated tests).
- Local `.env` files were created, excluded from Git, with a freshly generated JWT secret. No provider credentials were supplied or embedded.

## Browser checks

- Desktop landing page visually inspected in the in-app browser.
- Create-account link opens the registration form.
- Form submission sends a real backend request; disconnected database error appears inline without a crash or false success.
- Responsive layout checked at a 390 × 844 viewport; document width does not exceed viewport width.
- Mobile menu opens, exposes navigation links, and closes after navigating home.
- Service-status page shows API operational and database unavailable, matching the live backend response.
- Temporary viewport override was reset after checks.

## Limits

- Successful account creation/login/profile persistence were integration-tested and browser-tested against temporary MongoDB, not against Atlas.
- No Atlas, Gemini, Cloudinary, Render, or Vercel account connection/deployment was attempted.
- Report CRUD, uploads, AI extraction/matching, claim workflows, notifications and dashboards are later milestones; schema tests are not a substitute for their future endpoint/workflow tests.
- Browser checks are a targeted smoke test, not a comprehensive accessibility or cross-browser certification.
