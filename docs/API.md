# API contract

Base URL: `/api/v1`. JSON input only for current mutations. Cookies are sent with `credentials: include`; Axios uses `withCredentials: true`.

Success: `{ "success": true, "data": { ... } }`.

Failure: `{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [{ "field": "email", "message": "..." }], "requestId": "..." } }`. Details are optional. Unknown errors never expose stacks. Every response has `X-Request-Id`.

## Implemented routes

| Method | Route | Access | Response |
| --- | --- | --- | --- |
| GET | `/health` | Public | 200 liveness, service name and database state |
| GET | `/health/ready` | Public | 200 when Mongo is connected; 503 otherwise |
| POST | `/auth/register` | Public + origin/header guard | 201 public user + session cookie |
| POST | `/auth/login` | Public + origin/header guard | 200 public user + session cookie |
| POST | `/auth/logout` | Session + origin/header guard | 200; clears cookie and revokes user's sessions |
| GET | `/auth/me` | Session | 200 current public user |
| PATCH | `/users/me` | Session + origin/header guard | 200 updated public user |

Register body: `{ "name": "Your name", "email": "you@example.com", "password": "at-least-12-bytes" }`. Login body: `{ "email": "you@example.com", "password": "..." }`. Profile body: `{ "name": "Updated name" }`. Unknown fields are rejected; role, email, status and password cannot be updated through the profile endpoint. Password changes/email verification will need their own flows.

Public user: `id, name, email, role, createdAt`. Never passwordHash or tokenVersion. Current roles: `user`, `admin`. Account statuses: `active`, `suspended`.

All mutations require `Origin: <an exact CLIENT_ORIGIN>` and `X-Requested-With: ClaimBack`. Registration and login are rate limited (20 requests / 15 minutes); all API traffic is limited (300 / 15 minutes). Statuses include 400 validation, 401 invalid credentials/session, 403 authorization/origin, 404 route not found, 409 duplicate email, 413 payload too large, 415 wrong content type, 429 rate limit, 503 database unavailable.

## Planned routes — not implemented or advertised as callable

| Area | Method and route | Access / constraints |
| --- | --- | --- |
| Reports | `GET /reports` | Public, visible projection, bounded pagination |
| Reports | `GET /reports/:id` | Public; private/moderated data owner/admin only |
| Reports | `POST /reports` | Authenticated; validated multipart upload |
| Reports | `PATCH /reports/:id`, `DELETE /reports/:id` | Owner/admin; audit and image cleanup |
| Analysis | `POST /reports/:id/analyze` | Owner, strict quota, correction provenance |
| Matches | `GET /reports/:id/matches`, `POST /reports/:id/matches/refresh` | Owner; persisted bounded results |
| Interest | `POST /matches/:id/interest` | Owner of source report; idempotent |
| Claims | `POST /reports/:id/claims` | Authenticated non-owner; private evidence |
| Claims | `GET /claims/mine`, `GET /claims/:id` | Claimant/admin; evidence only when authorized |
| Claims | `PATCH /claims/:id/withdraw` | Claimant; pending state only |
| Dashboard | `GET /dashboard`, `GET /reports/mine` | Own counts/history/reports only |
| Notifications | `GET /notifications`, `PATCH /notifications/:id/read` | Recipient only |
| Admin | `GET /admin/analytics`, `GET /admin/users` | Admin only |
| Admin | `PATCH /admin/users/:id/status` | Admin; cannot remove last active admin |
| Admin | `GET /admin/reports`, `PATCH /admin/reports/:id/moderation` | Admin; reason required |
| Admin | `GET /admin/claims`, `PATCH /admin/claims/:id/review` | Admin; transaction + history |
| Handover | `POST /admin/claims/:id/handover` | Admin; atomic recovery transition |

Future report queries: `type`, `category`, `location`, `from`, `to`, `q`, `page` (>=1), `limit` (1–24). Sort newest first by default. All query fields will be parsed as scalars and explicitly mapped; arbitrary Mongo filter objects are forbidden. Match score means similarity only.
