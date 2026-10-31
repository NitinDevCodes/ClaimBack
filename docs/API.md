# API contracts

Base: `/api/v1`. Success envelope: `{success:true,data:...}`. Errors: `{success:false,error:{code,message,details?,requestId}}`. List responses contain `items,page,limit,total,pages`. Default page size 12, maximum 50. IDs are validated as ObjectIds.

Mutations require a trusted `Origin`, `X-Requested-With: ClaimBack`, and JSON, except report create/update which also accept multipart. Cookie authentication is HTTP-only; the browser must send credentials. All API responses use `Cache-Control: no-store`.

## Health and identity

| Method | Path | Access / request |
| --- | --- | --- |
| GET | /health | Public liveness, database status |
| GET | /health/ready | 200 only with connected DB; otherwise 503 |
| POST | /auth/register | `{name,email,password}`; creates regular user only |
| POST | /auth/login | `{email,password}` |
| POST | /auth/logout | Auth; `{}`; revokes all existing sessions |
| GET | /auth/me | Auth; safe current-user projection |
| PATCH | /users/me | Auth; `{name}` |

## Reports and matches

| Method | Path | Contract |
| --- | --- | --- |
| GET | /reports | Public, visible nondeleted reports; `q,type,category,location,from,to,status,page,limit`. Default status open. `q` uses MongoDB text index; location is escaped literal substring. |
| GET | /reports/:id | Public detail, no account IDs or Cloudinary public IDs |
| GET | /reports/mine | Auth, paginated own reports including hidden reports |
| GET | /reports/:id/manage | Owner-only editable detail and revision |
| GET | /reports/:id/access | Auth; `{isOwner}` without disclosing owner identity |
| POST | /reports | Auth; JSON or multipart, fields below. Returns `{report,matches,matchingStatus}` |
| PATCH | /reports/:id | Owner; partial editable fields plus required `revision`. Multipart photo replacements supported. |
| DELETE | /reports/:id | Owner; `{}`. Soft-deletes report, removes public images and cached matches. Forbidden with active claims or recovery history. |
| PATCH | /reports/:id/attributes | Owner; `{revision,attributes}`. Validated correction replaces extracted attributes and invalidates cached matches. |
| GET | /reports/:id/matches | Owner; ranked suggestions with `id,score,explanation,method,interested,report` |
| POST | /reports/matches/:matchId/interest | Source owner; `{}`. Idempotent interest and recipient notification. |

Create fields: `type` lost/found, `title` 3–120, `description` 10–3000, `category`, optional `colour` <=80, `location` 2–200, `occurredAt` parseable date. Categories: electronics, bags, wallets, keys, documents, jewellery, clothing, other. Multipart files use repeated `images`, up to 3 × 5 MB. JPEG/PNG/WebP only, actual decode required, <=20 megapixels, no animations. Output JPEG is resized <=1600px and metadata is stripped.

Update cannot change type or owner. `status` may change between open/closed. `clearImages: "true"` removes old photos; uploaded replacements take priority. Revision conflicts and active claim locks return 409. Reserved/recovered reports are immutable to owners.

Attributes: `{object,category,colours,brand,characteristics,distinctiveFeatures,keywords,improvedDescription}`. Strings bounded; lists <=20 entries (colours <=8), each <=120 characters. Additional fields rejected. Analysis status is complete, corrected, unavailable or pending.

## Claims and recovery

| Method | Path | Contract |
| --- | --- | --- |
| POST | /claims | Auth; `{reportId,privateEvidence,lostReportId?}`. Evidence 20–5000 characters. Found item must be open, visible and owned by someone else. Optional linked lost report must belong to claimant. |
| GET | /claims | Own claims; optional status, pagination. Admin can use `scope=review` for all claims. Lists never contain evidence. |
| GET | /claims/:id | Claimant/admin only; evidence, history, report. Admin additionally receives finder/claimant name and email for coordination. |
| PATCH | /claims/:id | `{action,reason}`; reason 5–1000. Claimant can withdraw pending claim. Independent admin can approve/reject pending claim or record handover for approved claim. |

Transitions: pending → approved/rejected/withdrawn; approved → handed_over. Approval reserves report, rejects competing pending claims, optionally reserves linked lost report, appends history and creates notifications in one transaction. Handover marks associated reports recovered in one transaction. A partial unique index guarantees one approved/handed-over claim per found report. Each claimant has at most one claim per found report. No AI ownership decisions.

## Workspaces

| Method | Path | Contract |
| --- | --- | --- |
| GET | /dashboard | Own live report/claim aggregates, recent reports, cached matches and unread count |
| GET | /notifications | Own paginated notices and unread count |
| PATCH | /notifications/:id/read | Own notice; `{}`. Use `all` to mark all own notices read. |
| GET | /admin/stats | Admin: users, reports by type/category, claims by state |
| GET | /admin/users | Admin; optional q (name/email), pagination |
| PATCH | /admin/users/:id | Admin; `{status:"active"|"suspended"}`. Regular users only; revokes sessions. |
| GET | /admin/reports | Admin; optional moderation hidden/visible, pagination |
| PATCH | /admin/reports/:id | Admin; `{moderation,reason}`. Reason 5–300, sent to owner. |

General limit: 300 requests / 15 minutes per IP. Auth attempts: 20 / 15 minutes. Report create/update and match retrieval: 20 / hour per authenticated account. Private evidence never appears in public report responses, notifications, ordinary logs or Gemini requests.
