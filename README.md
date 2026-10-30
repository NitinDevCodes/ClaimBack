# ClaimBack AI

A MERN lost-and-found platform foundation, designed for Gemini-assisted visual analysis, smart report matching, and human-reviewed ownership claims.

**Current release: foundation + identity.** The full reporting, AI, claim, and admin workflows are planned and are not yet implemented. The UI makes that scope explicit. No sample reports or fabricated dashboard statistics are used.

## What works

- React + Vite + Tailwind frontend with React Router, Axios, Lucide icons, responsive navigation, original SVG artwork, reusable forms/buttons, loading skeletons, empty/error states, and toast notifications.
- Landing page, registration/login, protected account page, editable display name, 404 page, and live service-status page.
- Express `/api/v1` API with MongoDB/Mongoose configuration, validated environment, request IDs, structured logging, error handling, Helmet, exact-origin CORS and mutation protection, rate limits, and graceful shutdown.
- bcrypt password hashing and HTTP-only JWT sessions. Backend session validation checks user status and token version; logout revokes all sessions. Registration cannot assign admin privileges.
- Mongoose schemas/indexes for users, reports, matches, private claims, and notifications. Only identity routes are active so far.
- 25 backend tests covering the foundation and safe database diagnostics. Database integration tests use a real temporary MongoDB process; `npm test` does not use Atlas credentials or production data.
- Vercel/Render configuration examples and a complete architecture, API plan, and phased roadmap.

## Run locally

Prerequisite: Node.js **22.12+** and npm. This workspace was verified with Node 26.3.0. A maintained Node LTS release is recommended for deployment.

```powershell
npm install
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
```

**This workspace already has ignored local `.env` files and a generated JWT secret.** Atlas connectivity to `claimback` was verified on 31 October 2026. Do not overwrite the configured files. For a new clone, set your own Atlas connection string in `server/.env` before using account features.

For a new clone, generate a JWT secret and paste it into `server/.env` (never share or commit it):

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Start both services from the repository root:

```powershell
npm run dev
```

- Frontend: **http://127.0.0.1:5173**
- API liveness: **http://127.0.0.1:5000/api/v1/health**
- API readiness: **http://127.0.0.1:5000/api/v1/health/ready**
- Vite proxies `/api` to Express. Both `localhost:5173` and `127.0.0.1:5173` are allowed locally.
- Stop the development processes with Ctrl+C. Ports 5173 and 5000 must be available.

### Keep the application available

`npm run dev` is a running process, not a one-time installation step. Keep its terminal open while using the app. Closing that terminal, pressing Ctrl+C, or restarting Windows stops the servers. Opening the URL afterward will show `ERR_CONNECTION_REFUSED` until you run `npm run dev` again. A successful build does not start a server.

On Windows, start from the project directory:

```powershell
Set-Location 'C:\Users\nitin\OneDrive\Desktop\ClaimBack'
npm run dev
```

Wait for Vite's `Local: http://127.0.0.1:5173/` and the API's `server_listening` message on port 5000. Use the frontend URL for the UI and `/api/v1/health` for the API; the backend root URL is not a webpage. If port 5173 is already occupied, Vite deliberately fails rather than silently switching ports. Do not start a second copy when the existing servers are already running.

During the foundation recheck, both servers were launched together in a hidden background process using the same root `npm run dev` command and left running. Its output is in the ignored `dev.stdout.log` and `dev.stderr.log` files. This is not a Windows startup service; restart it after a reboot. To inspect the running commands before stopping a background copy, use Task Manager's Details tab with the Command line column enabled; stop only the processes belonging to this ClaimBack checkout. For ordinary development, the foreground terminal command above is simplest to start and stop.

Check the website-to-API proxy at `http://127.0.0.1:5173/api/v1/health`. It should return the same service/database status as the direct backend health URL. An HTTP **503 DATABASE_UNAVAILABLE** means Express is reachable but MongoDB is unavailable; it is different from a refused TCP connection.

After adding or changing `MONGODB_URI` or other backend `.env` values, restart the backend (or both dev servers). The current backend watch script watches `server/src`, not `server/.env`. Do not replace an existing configured `.env` with the example.

If MongoDB is not configured, development still starts. The landing page and status page work; database-dependent endpoints return an explicit **503 DATABASE_UNAVAILABLE**. This is not an in-memory production mode, and no user data is silently stored elsewhere. Production refuses to start without a configured and reachable database.

## Environment variables

### Backend: `server/.env`

| Variable | Required now? | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | **Yes for account/data features** | Atlas connection string with database name, e.g. `mongodb+srv://USER:PASSWORD@HOST/claimback` |
| `MONGODB_DNS_SERVERS` | Optional; configured on this machine | Comma-separated resolver IPs for the backend Node process when default DNS fails SRV/TXT; leave blank on environments with working DNS |
| `JWT_SECRET` | **Yes for production; generated locally** | Random secret, minimum 32 bytes |
| `CLIENT_ORIGIN` | Default included | Comma-separated exact frontend origins, no trailing slash; HTTPS in production |
| `PORT` | Default `5000` | Express port; Render provides its own value |
| `NODE_ENV` | Default `development` | Set `production` on Render |
| `JWT_EXPIRES_IN` | Default `1d` | Allowed: `1h`, `8h`, `1d`, `7d` |
| `COOKIE_CROSS_SITE` | Default `false` | Set `true` for separate Vercel/Render HTTPS origins |
| `TRUST_PROXY` | Default `0` | Set `1` on Render |
| `GEMINI_API_KEY` | Later | Backend-only Google Gemini key |
| `GEMINI_MODEL` | Later | Supported Gemini model selected when AI integration is implemented |
| `CLOUDINARY_CLOUD_NAME` | Later | Image-storage account name |
| `CLOUDINARY_API_KEY` | Later | Backend-only upload credential |
| `CLOUDINARY_API_SECRET` | Later | Backend-only upload secret |

For Atlas, create a dedicated database user, allow your development network, and use the database name in the URI. URL-encode special characters in the database password. Development creates indexes for active models after connection.

On this machine the default Node DNS resolver refused Atlas SRV queries. `MONGODB_DNS_SERVERS=1.1.1.1,8.8.8.8` in the ignored `server/.env` selects verified working resolvers for the backend process only. It does not change Windows DNS, disable TLS verification, or change Atlas IP access rules. This override is explicit and optional, not a silent fallback. See [the database diagnosis](docs/MONGODB_DIAGNOSIS.md) for evidence and verification results.

### Frontend: `client/.env`

- `VITE_API_URL=/api/v1` locally. On Vercel, use `https://YOUR-API.onrender.com/api/v1`.
- `API_PROXY_TARGET=http://127.0.0.1:5000` controls only the local Vite proxy.
- **Never place secrets in `VITE_*` variables.** Vite embeds them in browser code.

## Verification

```powershell
npm test
npm run build
# Both:
npm run check
```

Tests launch an isolated MongoDB process on a temporary port and remove its data afterward. The first run may download an official MongoDB binary; network access and permission to run that process are required. A restricted Windows sandbox may fail to start MongoDB: run the same tests in a normal local terminal. Tests never use `MONGODB_URI` and do not require Gemini or Cloudinary.

Coverage includes registration/login, password hashing, duplicate emails, authenticated profile editing, mass-assignment rejection, expired/invalid JWTs, revocation, suspended accounts, role guards, origin/CSRF protection, CORS, body limits, malformed input, rate limiting, unavailable database responses, private claim projections, and exclusive claim approval indexes.

## Deployment preparation

These are configuration examples; the project has **not** been deployed or verified against hosted providers.

1. Create Atlas and configure the backend environment.
2. Before serving production traffic, create the declared collections/indexes with `npm run db:indexes -w server` from a trusted environment configured for that database. This command creates missing indexes and never drops existing indexes. Review uniqueness conflicts before proceeding.
3. Render: repository root, `npm ci --omit=dev`, `npm start`, readiness health path `/api/v1/health/ready`. `render.yaml` includes environment prompts. Automatic index creation is disabled in production; apply the index setup first.
4. Vercel: repository root, `npm ci`, `npm run build`, output `client/dist`, and the deployed API URL in `VITE_API_URL`. `vercel.json` supports React Router refreshes.
5. Set Render `CLIENT_ORIGIN` to the exact Vercel origin, `COOKIE_CROSS_SITE=true`, `TRUST_PROXY=1`, and `NODE_ENV=production`.
6. Verify cookie persistence, CORS, profile access and logout in the deployed browser. For browsers that block third-party cookies, prefer frontend/API domains under the same parent domain.

Account email verification, password recovery, full admin tooling, upload safeguards and real-provider integration are still release work. The current milestone is not a claim of production readiness.

## Project map

```text
ClaimBack/
├── client/                 React frontend and local environment example
│   ├── public/             Favicon
│   └── src/
│       ├── components/     Layout, route guard, error boundary, shared UI
│       ├── contexts/       Session and toast providers
│       ├── lib/            Axios and error formatting
│       ├── pages/          Home, auth, account, status and 404
│       ├── App.jsx
│       ├── main.jsx
│       └── styles.css
├── server/
│   ├── src/
│   │   ├── config/         Environment and database
│   │   ├── controllers/    Authentication and profile endpoints
│   │   ├── middleware/     Security, validation, auth and errors
│   │   ├── models/         Five application collections
│   │   ├── routes/         Authentication and user routes
│   │   ├── scripts/        Explicit database index setup
│   │   ├── services/       Authentication service
│   │   ├── utils/          Errors and logging
│   │   ├── app.js
│   │   └── server.js
│   └── test/               Backend integration/security tests
├── docs/ARCHITECTURE.md     Complete system design, schemas and roadmap
├── docs/API.md              Implemented and planned API contracts
├── package.json            Workspace scripts
├── package-lock.json       Reproducible dependency versions
├── render.yaml             Backend deployment example
└── vercel.json             Frontend deployment example
```

## Next milestone

Implement report CRUD and ownership checks, public search/filtering, detail pages, and restricted Cloudinary uploads; test that module before adding Gemini image analysis and bounded semantic matching. Then implement private claims, audited human review, notifications, user/admin dashboards, and deployment verification. See [the full roadmap](docs/ARCHITECTURE.md) and [API contracts](docs/API.md).
