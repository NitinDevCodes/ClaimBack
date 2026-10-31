# Implementation and verification report — 31 October 2026

Later live-provider verification supersedes the provider-configuration status in this implementation snapshot: Cloudinary and the actual Atlas recovery workflow passed; Gemini generation remains unavailable despite successful metadata authentication. See [Live provider verification](LIVE_PROVIDER_VERIFICATION.md) for current results, fixes and limitations.

## Outcome

The existing authentication foundation has been extended into an integrated ClaimBack application. The React interface is connected to Express endpoints backed by the existing Atlas configuration. No existing user was promoted, edited, removed or seeded during this work. No Atlas URI, DNS resolver, TLS-validation or IP-access configuration was changed by the implementation. The user updated their current Atlas IP entry after a transient connection failure; the real claimback connection was then verified again.

## Delivered modules

| Module | Implementation |
| --- | --- |
| Lost/found reporting | Create, edit, close/reopen and delete own reports; revision conflicts; public detail; search, category/location/date/type/status filters; bounded pagination; separate lost/found views |
| Photographs | Up to 3 × 5MB; actual JPEG/PNG/WebP decode; 20MP limit; rotation/resize and metadata stripping; backend Cloudinary upload; replacement/deletion and partial-failure cleanup |
| Gemini understanding | Official backend SDK; inline normalized photographs; object/category/colours/brand/features/keywords/enhanced description; JSON-schema output plus strict Zod validation; owner corrections |
| Matching | Bounded MongoDB candidates, top-8 batch semantic comparisons, hybrid scores/explanations, versioned 24-hour cache, 15-minute discovery cooldown, concurrent request deduplication, attribute fallback, interest notifications |
| Ownership and recovery | Private evidence, claimant/admin access, independent human approval/rejection, withdrawal, transactional reservation and competing-claim rejection, confirmed handover, linked lost-report recovery, immutable history |
| User workspace | Live statistics, lost/found reports, cached suggestions, claims, recovery history, profile and notifications |
| Admin workspace | Live counts/category analytics, paginated user management, suspension/session revocation, report inspection/moderation, private claim review and administrator-only handover contacts |
| Notifications | Persisted match/interest/claim/recovery/moderation updates, unread counts, single/all read actions |
| UI | Existing visual system retained; responsive cards/forms/dashboards; mobile navigation; loading, empty, error and success states; privacy and similarity explanations |
| Deployment | Updated environment example and Render configuration, Vercel build retained, explicit admin/index commands, deployment and interview demonstration guides |

## Main file changes

- `server/src/services/ai.service.js`: validated, backend-only Gemini analysis and ranking.
- `server/src/services/images.service.js`: restricted upload parsing, real image validation, Cloudinary adapter and cleanup.
- `server/src/services/matching.service.js`: candidate selection, local/hybrid scoring, caching and match notifications.
- `server/src/services/claims.service.js`: atomic claim/recovery state machine and audit history.
- `server/src/controllers/report.controller.js`, `workflow.controller.js`, `admin.controller.js`: report/claim/workspace/admin API contracts.
- `server/src/routes/report.routes.js`, `workflow.routes.js`: route guards and limits; `app.js` mounts them while preserving auth routes.
- `server/src/models/Report.js`, `Match.js`, `Claim.js`: revisions, soft deletion, cache metadata and optional linked lost reports. Existing schemas/auth remain intact.
- `server/src/middleware/security.js`, `errors.js`, `utils/query.js`: restricted multipart support, safe upload/conflict errors and validated bounded queries.
- `client/src/pages/ReportsPage.jsx`, `ReportFormPage.jsx`, `ReportDetailPage.jsx`, `DashboardPage.jsx`, `ClaimsPage.jsx`, `NotificationsPage.jsx`, `AdminPage.jsx`: connected application screens.
- `client/src/components/application.jsx`, `hooks/useResource.js`: reusable cards/forms/navigation and abortable API loading.
- `client/src/App.jsx`, `components/Layout.jsx`, existing landing/auth/profile/status pages and `styles.css`: routing, navigation, responsive styling and current product copy; auth redirects now preserve the intended protected destination.
- `server/src/scripts/grant-admin.js`: explicit operator-only role assignment; not executed on existing accounts.
- `server/scripts/synthetic-demo.js`: optional ephemeral browser-demo environment, separate from Atlas.
- `server/test/application.test.js`, `ai.test.js`: application, provider-contract, image-safety, privacy, concurrency and failure-path coverage.
- Workspace package files/lockfile: multer and sharp added, useful scripts added. No alternate framework, microservice or frontend state library introduced.
- README, API/architecture/deployment/verification documents and browser screenshots updated.

## Verification evidence

- **42 backend tests passed, 0 failures.** Existing 25 foundation/diagnostic checks remain covered, plus 17 application/AI/image tests.
- Authentication: registration, hashing, cookie/session protections, login/logout, revoked/expired tokens, suspended accounts, authorization and input/rate-limit failures.
- Reporting: multipart upload, public serialization, malicious file rejection, filtering, ownership, revision conflicts, corrections, partial-upload cleanup and missing-provider behavior.
- AI: validated successful extraction and ranking, inline image payload, no private/account fields sent, malformed/oversized/error responses and unknown/duplicate candidate IDs.
- Matching: deterministic fallback, semantic cache reuse, concurrent sharing, revision-based stale-result exclusion, idempotent interest and private notifications.
- Claims: private evidence access, active-claim edit/delete locks, competing concurrent approvals, automatic competitor rejection, transactional handover/history, linked report recovery, withdrawal and deletion visibility.
- Admin: access boundaries, moderation, protected admin accounts, regular-user suspension and token revocation, live aggregates.
- **Frontend production build passed**, 1,670 transformed modules. Approximately 388KB JavaScript / 125KB gzip; CSS approximately 34KB / 9KB gzip.
- **Production dependency audit: 0 known vulnerabilities** at the time of checking.
- Browser: public search/type filtering; mobile navigation; login; dashboard; actual form submission; private claim; independent admin approval; handover; updated recovery count; notification read state. No browser JavaScript warnings/errors were observed in the tested workflow.
- Responsive checks: 1280×900 desktop and 390×844 mobile; no document-level horizontal overflow. Screenshots: `application-desktop-verification.png` and `application-mobile-verification.png`. All displayed records are synthetic.
- Live main environment: frontend 200; backend health and readiness 200; Vite health/report proxy 200; actual configured database claimback connected. Live checks were read-only. The new public report list was empty, not populated with fake demonstration records.

Automated tests use temporary MongoDB instances/replica sets. Remote providers are controlled substitutes in tests. Browser workflow verification used a separately named ephemeral synthetic database on ports 5174/5001. These results do not pretend that live Gemini or Cloudinary requests succeeded.

## Configuration still required

1. Configure `GEMINI_API_KEY` and `GEMINI_MODEL` in `server/.env` to enable real image understanding and semantic ranking. Both were absent during verification.
2. Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` for real photo storage. These were absent during verification.
3. Restart the backend after setting those values. Verify a real non-sensitive photo upload, Gemini extraction and semantic ranking against your provider project/quota before the interview.
4. Grant the desired existing active account administrator access using the explicit documented CLI, then log in again. No existing user's role was changed automatically.
5. Follow `DEPLOYMENT.md` for Vercel/Render URLs, CORS, production cookies, provider secrets, Atlas access and indexes. No cloud deployment was published.

## Operational limits and honest boundaries

- Gemini-unavailable reports remain useful with explicit fallback; Cloudinary-unavailable photo submissions fail visibly while text reports work.
- Similarity is a heuristic, not proof of ownership. Claims require independent human judgment.
- Discovery is request-driven and cached, not a background subscription or live push service. In-app notifications refresh on page navigation/reload.
- Matching retrieves at most 100 candidates within ±90 days, then ranks up to 8; this trades recall for bounded cost. Locations use text, not geocoding.
- In-memory rate limits and match-work deduplication target a single API instance. Distributed deployment would need shared coordination.
- Failed Cloudinary deletion is logged for operator cleanup rather than silently discarded; no persistent cleanup worker is included.
- Cross-site Render/Vercel cookies can be blocked by browser privacy settings. Same-site custom subdomains are preferable for a dependable demo.
- Account email remains read-only; the preserved foundation does not claim email verification/password-reset functionality.

## Running and demonstrating

`npm run dev` from the project root runs the real app at http://127.0.0.1:5173 with backend http://127.0.0.1:5000. Keep the terminal/process running. A server that has been stopped cannot serve a browser URL.

For a repeatable isolated fallback demonstration, `npm run demo:synthetic` launches http://127.0.0.1:5174. See README for the explicitly synthetic credentials and cleanup command. It never points the main app at a temporary database.

For a live AI interview demonstration: configure providers; use two synthetic user accounts and a separate admin; publish matching lost/found reports with synthetic/non-sensitive photos; inspect/correct Gemini attributes; compare ranked explanations; express interest; submit private evidence with a linked lost report; approve independently; record handover; show notifications and recovered counts. Explain cache bounds, provider validation and the ownership/privacy boundary using `ARCHITECTURE.md`.
