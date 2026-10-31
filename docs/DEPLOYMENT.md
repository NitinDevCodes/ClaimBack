# Deployment preparation

## MongoDB Atlas

Use the intended `claimback` database and a dedicated application user with readWrite on that database. Configure the backend host's outbound IP addresses in Atlas Network Access. Keep access limited; do not use unrestricted 0.0.0.0/0 as a convenience fix. A developer's public IP can change or a temporary entry can expire. Credentials do not bypass the IP access list.

Retain the existing MONGODB_DNS_SERVERS value locally if needed. Configure it elsewhere only after diagnosing a real SRV/TXT DNS issue. Never disable certificate validation. See MongoDB's [connection troubleshooting](https://www.mongodb.com/docs/atlas/troubleshoot-connection/).

Before serving production traffic, initialize collections/indexes with the production environment:

```sh
npm run db:indexes -w server
```

This script creates declared indexes and never drops collections/indexes or rewrites users. Existing data conflicting with a unique index must be reviewed deliberately, not deleted automatically. Production starts fail closed if MongoDB cannot connect; readiness is `/api/v1/health/ready`.

## Render backend

1. Connect the repository; use the root `render.yaml` Blueprint or a Node web service with build `npm ci --omit=dev` and start `npm start`.
2. Use Node 22.12+ (the Blueprint selects 22). Set NODE_ENV=production, stable JWT_SECRET, MONGODB_URI selecting claimback, CLIENT_ORIGIN to the exact HTTPS Vercel origin, TRUST_PROXY=1.
3. Set GEMINI_API_KEY and GEMINI_MODEL. Choose a model currently available to your Google project that supports image input and structured JSON. Set all three Cloudinary credentials.
4. For separate Render/Vercel domains, set COOKIE_CROSS_SITE=true (Secure; SameSite=None). Browsers that block third-party cookies may still reject cross-site sessions; prefer custom subdomains of the same registrable domain for a reliable demo. Verify login in the browser you intend to demonstrate.
5. Initialize indexes, deploy, and check readiness before directing users to the site. Grant the intended existing administrator through the explicit CLI command if required.

Cloudinary assets are public report photographs. Use only appropriate non-sensitive images. Configure provider quotas and monitor safe `ai_unavailable`, `matching_failed`, `image_cleanup_failed` and database events. Retry failed Cloudinary cleanup using the logged asset ID from your Cloudinary console; the application does not run a persistent background cleanup worker.

## Vercel frontend

Use the repository-root `vercel.json` configuration. It installs at the monorepo root, builds the client, serves `client/dist`, and rewrites client routes to index.html. Set frontend `VITE_API_URL=https://YOUR-RENDER-HOST/api/v1` before building. Do not copy any provider secret to Vercel frontend variables. Add the exact resulting frontend origin to the backend CORS list and redeploy/restart that backend configuration.

For a custom-domain setup, use `app.example.com` and `api.example.com` to avoid third-party cookie blocking. HTTPS remains mandatory in production.

## Release verification

- `npm run check`: backend tests and frontend build.
- Readiness 200; database connected to claimback.
- Register/login/logout, protected dashboard, cookie persistence after refresh.
- Real Cloudinary upload, image render, replace/remove and storage cleanup.
- Real Gemini extraction, user correction, semantic ranking, quota/unavailable fallback.
- Two users + independent admin: claim, competing rejection, approval, handover, notifications, recovery counts.
- Check anonymous/non-owner requests cannot access private evidence or modify reports.
- Verify mobile form/card layouts and client-side deep links.

No deployment was published during implementation. Real provider verification still requires valid project credentials. The automated suite mocks remote providers and cannot establish their billing, quota, model availability or production delivery configuration.
