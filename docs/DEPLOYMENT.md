# Deployment preparation

Reviewed 1 November 2026. The local application passed live provider/admin verification and `npm run check`. No public deployment or production setting was changed. The steps below are an operator handoff, not a claim that hosted production has been verified.

## Required production configuration

| Location | Variable | Production value |
| --- | --- | --- |
| Render | `NODE_VERSION` | `22` in the existing Blueprint; use a release at least 22.12 |
| Render | `NODE_ENV` | `production` |
| Render | `PORT` | Use the platform-provided port; Express reads it |
| Render | `MONGODB_URI` | Approved Atlas connection selecting `claimback` |
| Render | `JWT_SECRET` | Stable backend-only secret, at least 32 bytes; preserve an already configured production value |
| Render | `JWT_EXPIRES_IN` | `1d` in the Blueprint |
| Render | `CLIENT_ORIGIN` | Exact HTTPS frontend origin, no path or trailing slash; comma-separated only for explicitly approved additional origins |
| Render | `TRUST_PROXY` | `1` for the configured Render reverse proxy |
| Render | `COOKIE_CROSS_SITE` | `true` for separate `vercel.app` / `onrender.com` sites; `false` is suitable for HTTPS subdomains of the same registrable domain |
| Render | `GEMINI_API_KEY` | Existing working backend key |
| Render | `GEMINI_MODEL` | `gemini-3.5-flash-lite`, the model verified live in this project |
| Render | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Existing working backend credentials |
| Render | `MONGODB_DNS_SERVERS` | Optional; do not copy a local override without an actual production DNS need |
| Vercel | `VITE_API_URL` | `https://YOUR-BACKEND-HOST/api/v1`, set before the frontend build |

Never place Atlas, JWT, Gemini or Cloudinary secrets in any `VITE_` variable. `API_PROXY_TARGET` is a Vite development-server setting and is not the production API routing mechanism. Leaving `VITE_API_URL` at the local `/api/v1` value on Vercel would target the frontend host instead of Render.

## MongoDB Atlas

Use the intended `claimback` database and a dedicated application user with readWrite on that database. Configure the backend host's outbound IP addresses in Atlas Network Access. Keep access limited; do not use unrestricted 0.0.0.0/0 as a convenience fix. A developer's public IP can change or a temporary entry can expire. Credentials do not bypass the IP access list.

In Render, open the service's **Connect → Outbound** panel and allow the listed CIDR ranges in Atlas. These are shared regional ranges, and the service can use any address within them; do not assume one observed address is sufficient. See [Render outbound IP documentation](https://render.com/docs/outbound-ip-addresses). Claim/recovery transactions require Atlas or another replica-set deployment, not standalone MongoDB.

Retain the existing MONGODB_DNS_SERVERS value locally if needed. Configure it elsewhere only after diagnosing a real SRV/TXT DNS issue. Never disable certificate validation. See MongoDB's [connection troubleshooting](https://www.mongodb.com/docs/atlas/troubleshoot-connection/).

Before serving production traffic, initialize collections/indexes with the production environment:

```sh
npm run db:indexes -w server
```

This script creates declared indexes and never drops collections/indexes or rewrites users. Existing data conflicting with a unique index must be reviewed deliberately, not deleted automatically. Production starts fail closed if MongoDB cannot connect; readiness is `/api/v1/health/ready`.

## Render backend

1. Connect the repository; use the root `render.yaml` Blueprint or a Node web service with build `npm ci --omit=dev` and start `npm start`.
2. Use Node 22.12+ (the Blueprint selects 22). Set NODE_ENV=production, stable JWT_SECRET, MONGODB_URI selecting claimback, CLIENT_ORIGIN to the exact HTTPS Vercel origin, TRUST_PROXY=1.
3. Set GEMINI_API_KEY and GEMINI_MODEL=`gemini-3.5-flash-lite`. Set all three Cloudinary credentials, using the existing verified values.
4. For separate Render/Vercel domains, set COOKIE_CROSS_SITE=true (Secure; SameSite=None). Browsers that block third-party cookies may still reject cross-site sessions; prefer custom subdomains of the same registrable domain for a reliable demo. Verify login in the browser you intend to demonstrate.
5. Initialize indexes, deploy, and check readiness before directing users to the site. Grant the intended existing administrator through the explicit CLI command if required.

Cloudinary assets are public report photographs. Use only appropriate non-sensitive images. Configure provider quotas and monitor safe `ai_unavailable`, `matching_failed`, `image_cleanup_failed` and database events. Retry failed Cloudinary cleanup using the logged asset ID from your Cloudinary console; the application does not run a persistent background cleanup worker.

## Vercel frontend

Use the repository-root `vercel.json` configuration. It installs at the monorepo root, builds the client, serves `client/dist`, and rewrites client routes to index.html. Set frontend `VITE_API_URL=https://YOUR-RENDER-HOST/api/v1` before building. Do not copy any provider secret to Vercel frontend variables. Add the exact resulting frontend origin to the backend CORS list and redeploy/restart that backend configuration.

For a custom-domain setup, use `app.example.com` and `api.example.com` to avoid third-party cookie blocking. HTTPS remains mandatory in production.

Select the **repository root** as Vercel's Root Directory, with the Vite framework preset and explicit overrides from `vercel.json`: install `npm ci`, build `npm run build`, output `client/dist`. Keep the existing SPA rewrite so direct visits to `/admin`, `/claims/:id` and `/reports/:id` reach React. Build-time variables require a rebuild after changes; see [Vercel's Vite documentation](https://vercel.com/docs/frameworks/frontend/vite).

## Authentication checks before opening access

The frontend sends credentials and `X-Requested-With: ClaimBack`. Express validates exact origins, permits credentialed CORS, and rejects mutation requests without an allowed Origin/header. Do not replace the origin list with a wildcard.

Production cookies are HttpOnly and Secure, scoped to `/api/v1`. `COOKIE_CROSS_SITE=true` sets SameSite=None; false sets SameSite=Lax. Third-party-cookie restrictions can still block sessions between unrelated platform domains. Choose the domain/cookie arrangement before an interview demo and verify login, refresh and logout in the intended browser.

If production uses the existing database, the preserved permanent administrator already has the role; no role reassignment is required. Use the normal `/login` page, then Dashboard → Administration (`/admin`). For a separate fresh production database, an authorized operator must explicitly create/select an account before using the documented `admin:grant` command. There is no default administrator or separate admin password.

## Ordered deployment handoff

1. Review and commit the intended source/configuration/documentation changes to the chosen repository. Keep `.env`, logs and `test-results` ignored. Do not commit verification credentials.
2. Choose the frontend/backend HTTPS URLs. Prepare the exact environment values above in the respective platform dashboards; never upload local `.env` as a public artifact.
3. Configure Atlas access for the Render service's outbound ranges and initialize indexes using `npm run db:indexes -w server` from a trusted environment configured for the intended production database. Review index conflicts instead of deleting data. Do not use the disposable demo database.
4. With approval to publish, deploy the Render Node service from repository root using the existing Blueprint or equivalent settings. Check `/api/v1/health/ready` returns 200 with `database: connected`.
5. Deploy the Vercel frontend from repository root with the build settings and `VITE_API_URL` above. Ensure Render's `CLIENT_ORIGIN` exactly matches the actual Vercel/custom-domain origin; restart the backend if it changes.
6. Verify direct deep links, credentialed login/refresh/logout and admin restrictions on the deployed domains. Run the release journey below with fresh labelled synthetic records, then remove only those records.

These publishing steps were **not executed**. Final domains, remote environment variables, Atlas production network access, Linux/Node 22 hosting behavior and deployed browser cookie behavior remain to be verified on the actual hosts.

The existing Blueprint uses Render's Free plan. It spins down after 15 idle minutes and can take about a minute to wake, which can exceed the frontend's normal request timeout. Check readiness before a scheduled demo; no plan or billing change was made. See [Render Free service limitations](https://render.com/docs/free).

## Release verification

- `npm run check`: backend tests and frontend build.
- Readiness 200; database connected to claimback.
- Register/login/logout, protected dashboard, cookie persistence after refresh.
- Real Cloudinary upload, image render, replace/remove and storage cleanup.
- Real Gemini extraction, user correction, semantic ranking, quota/unavailable fallback.
- Two users + independent admin: claim, competing rejection, approval, handover, notifications, recovery counts.
- Check anonymous/non-owner requests cannot access private evidence or modify reports.
- Verify mobile form/card layouts and client-side deep links.

No deployment was published during implementation. Real Gemini 3.5 Flash-Lite and Cloudinary requests succeeded locally with the configured credentials; see the linked verification reports. The automated suite mocks remote providers and cannot establish future availability, quotas or hosted production behavior. Local live success must not be presented as a deployed production smoke test.
