# Architecture

## Boundaries

The existing npm-workspace MERN application is retained. Vite/React handles navigation, forms and presentation. Express owns authentication, validation, provider calls, matching and transactional recovery. MongoDB Atlas is the application database. There is no runtime local-database fallback.

```
client/src/
  components/       Shared layout, access guard, form/card/list primitives
  contexts/         Authentication and toast state
  hooks/            Abortable API resource loading and refresh
  pages/            Public reports, report editor/detail, dashboards, claims, notices
  lib/api.js        Credentialed Axios client and normalized error messages
server/src/
  config/           Module-relative environment loading, existing Mongo DNS opt-in
  middleware/       Authentication, role guards, mutation-origin checks, errors
  models/           User, Report, Match, Claim, Notification
  routes/           Endpoint wiring, upload and costly-request limits
  controllers/      HTTP contracts, ownership checks, pagination, admin views
  services/         Auth, Gemini, Cloudinary/normalization, matching, claim transactions
  utils/            Safe logging, diagnostics, query validation
  scripts/          Explicit index setup and operator-only administrator grant
server/test/        Isolated Mongo/replica-set integration and provider-contract tests
server/scripts/     Disposable synthetic browser demo (never Atlas)
```

## Report lifecycle

Public browse exposes visible, nondeleted reports. Public serializers omit owner IDs, provider asset IDs and all claim evidence. Owners manage only their own reports. Edits use a numeric revision to reject stale writes; claim submission and all review transitions write that same report to serialize competing operations. Active claims lock report details and AI corrections. Reserved/recovered reports cannot be edited or deleted by their owners. Deletion is soft at the report level; uploaded images and cached matches are removed, while nonpublic history remains.

## Image and Gemini pipeline

Authenticated multipart → bounded in-memory Multer parser → Sharp actual-image validation (JPEG/PNG/WebP; no animations; max 20MP) → auto-rotate, downsize <=1600px, metadata-free JPEG → backend Cloudinary stream upload → Gemini inline normalized bytes plus public item text → strict Zod validation → report persistence.

At most 3 files × 5MB. Partial upload/save failures trigger cleanup of newly uploaded assets; replacement/deletion removes old assets after persistence. A Cloudinary cleanup failure is safely logged with an asset ID for operator retry. No client-supplied remote URL is fetched, preventing a remote-image SSRF path.

The official `@google/genai` SDK is constructed only on the backend. `GEMINI_API_KEY` and `GEMINI_MODEL` enable it; request deadline 20 seconds, bounded structured JSON output, no tools. Prompt text explicitly treats item content as untrusted data. Zod enforces bounds and enums, and ranking output must contain exactly the requested unique candidate IDs. Errors yield an explicit unavailable state/fallback; raw provider errors are not logged. Prompt instructions are an additional guard, not a substitute for output validation. Owner corrections have separate provenance and do not silently rewrite their original description.

## Matching and cost controls

A report searches open, visible opposite-type reports belonging to other users. Dates are bounded to ±90 days; category is the same or other (an other-category source searches all categories). MongoDB retrieves at most 100 recent candidates. Local attribute scoring selects the top 8. One batch Gemini request compares only uncached candidates. Final similarity is 70% semantic score + 30% local score when AI succeeds; otherwise local scoring is used.

Local score: category 25, colour token overlap 15, location overlap 15, title/description/keyword overlap 35, date proximity 10. This is an explainable heuristic, not a calibrated ownership probability. It has no geographic distance or visual-embedding database. Gemini supplies semantic reasoning from extracted image attributes and item text.

Discovery refresh has a 15-minute cooldown. Scores cache for 24 hours with source and candidate revisions. Concurrent requests for one source share work within a process. Unchanged candidate scores survive discovery refresh without another AI call. Changed, closed, hidden, deleted or expired candidates are excluded. New arrivals are found on the next eligible refresh; there is no background worker or realtime push. Match/interest notifications are generated during workflows. The MVP targets one API instance; horizontal scaling would require distributed rate limits and matching locks.

## Human ownership review

Claims contain private evidence excluded from default Mongoose projections. Explicit claim-detail authorization allows only claimant/admin; lists, public reports and notifications exclude evidence. Admin-only detail additionally supplies participant contacts for manual coordination. An administrator cannot review their own item or claim.

A MongoDB transaction performs the claim transition, report reservation/recovery, optional linked lost-report transition, history entries, competitor rejection and notifications. A partial unique index enforces a single approved/handed-over claim per found report. Approval races are tested. Atlas supports these transactions; a standalone local MongoDB instance does not.

## Existing security preserved

bcrypt passwords; HTTP-only JWT cookies; issuer/audience checks; revocable token versions; role checks; strict input validation; trusted Origin plus custom-header mutation checks; explicit credentialed CORS; Helmet; no-store APIs; bounded request bodies and pagination; global/auth/costly-operation rate limits. Provider credentials stay in server/.env. Existing Atlas URI, DNS configuration and user accounts are not rewritten by this implementation.

## Provider references

- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [Cloudinary Node uploads](https://cloudinary.com/documentation/node_image_and_video_upload)
- [Sharp input limits](https://sharp.pixelplumbing.com/api-constructor/)
