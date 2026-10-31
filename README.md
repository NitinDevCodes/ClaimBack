# ClaimBack AI

An integrated MERN lost-and-found application: public item search, secure accounts, photographs, Gemini item understanding, ranked matching, private ownership claims, human review, recovery tracking, dashboards and notifications.

Live verification (31 October 2026): **Gemini 3.5 Flash-Lite passed real text, photograph understanding, structured extraction and ClaimBack semantic matching**, using the existing key. The backend now selects `gemini-3.5-flash-lite`. See [the successful live verification report](docs/GEMINI_FLASH_LITE_VERIFICATION.md). Cloudinary and the Atlas recovery workflow also passed [earlier live checks](docs/LIVE_PROVIDER_VERIFICATION.md); the previous automated run passed 44 backend tests and the production build. [Gemini 3.8 diagnosis](docs/GEMINI_DIAGNOSIS.md) records that model's earlier capacity failures.

## Run locally

Requires Node.js 22.12+ and npm. Use MongoDB Atlas or a replica set; claim/recovery operations use transactions.

```powershell
npm ci
# First setup only: copy server/.env.example to server/.env and client/.env.example to client/.env.
# Do not overwrite an existing configured .env.
npm run dev
```

- Frontend: http://127.0.0.1:5173
- Backend: http://127.0.0.1:5000/api/v1/health
- Readiness: http://127.0.0.1:5000/api/v1/health/ready
- Root `npm run dev` starts both workspaces. Keep that process running. Closing it stops the servers; a stopped server produces `ERR_CONNECTION_REFUSED`.
- Vite proxies `/api` to port 5000. The development backend watches `server/.env` as well as source files; production requires an explicit restart after environment changes. Restart an already-running older dev command once to use the new watcher.

## Configuration

Backend loads **server/.env**, relative to the configuration module, independently of shell working directory. Never put provider credentials in a `VITE_` variable.

| Variable | Purpose |
| --- | --- |
| MONGODB_URI | Atlas URI selecting `/claimback`; URL-encode credential special characters |
| MONGODB_DNS_SERVERS | Existing optional process-local DNS override; leave unchanged if working |
| JWT_SECRET | Stable random secret, at least 32 bytes |
| CLIENT_ORIGIN | Exact allowed frontend origins, comma separated |
| PORT | Backend port, default 5000 |
| GEMINI_API_KEY | Backend-only Google AI API key |
| GEMINI_MODEL | A currently available Gemini model supporting images and structured JSON |
| CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET | Backend Cloudinary credentials |
| COOKIE_CROSS_SITE | false locally; true for separate HTTPS Vercel/Render origins |
| TRUST_PROXY | 0 locally; 1 behind Render's proxy |

Without Gemini, reports save with an explicit unavailable state and deterministic attribute matching works. Without Cloudinary, text reports work; photo submissions return an explicit 503. The application never fabricates an AI result or switches the configured database to a local fallback.

## Workflows

1. Register two users: a finder and an owner. Publish a found report and a similar lost report with non-sensitive item photos.
2. Review extracted attributes and enhanced descriptions. Owners can correct suggestions. Item text and photos are public; never include private proof there.
3. Open a report to see ranked opposite-type suggestions and explanations. Express interest, then submit a private claim on a found report. Optionally link your lost report.
4. An independent administrator reviews evidence, approves or rejects the claim, and coordinates handover using administrator-only participant contacts.
5. Record the actual handover. The found report and linked lost report become recovered; history and notifications persist atomically. Unlinked lost reports can be closed by their owner.

Only the claimant and administrators can access private evidence. Gemini never receives claim evidence or account credentials. Scores measure similarity, not ownership probability. AI cannot approve a claim.

## Administrator setup

Create an account normally. An authorized operator can grant that existing active account administrator access:

```powershell
npm run admin:grant -w server -- your-account@example.com --confirm
```

This command intentionally changes the specified user's role and revokes existing sessions. Sign in again afterward. There is no public role-assignment endpoint or default production administrator. The development work did not promote any existing Atlas account.

## Tests and isolated demonstration

```powershell
npm test
npm run build
npm run check
npm run demo:synthetic
```

Tests create isolated temporary MongoDB databases, including a replica set for transactions. Gemini and image storage are controlled substitutes in integration tests; image decoding is real. They never use your Atlas data.

`demo:synthetic` starts a separate disposable environment at **http://127.0.0.1:5174** with backend port 5001. It always creates its own temporary MongoDB replica set and does not read the Atlas URI for a connection. Its three synthetic users are `owner@example.test`, `finder@example.test`, and `admin@example.test`, with password `Synthetic-demo-only-2026!`. These are local test accounts only. Gemini/Cloudinary are intentionally disabled, so the demo clearly shows fallback matching. Type `stop` in that terminal to discard the entire isolated environment. Do not deploy this script or use its password for real accounts.

## Deployment

See [deployment instructions](docs/DEPLOYMENT.md), [API contracts](docs/API.md), [architecture](docs/ARCHITECTURE.md), and [implementation/verification report](docs/IMPLEMENTATION_REPORT.md).

The frontend build is in `client/dist`. `render.yaml` and `vercel.json` provide deployment configuration. Nothing is published automatically.
