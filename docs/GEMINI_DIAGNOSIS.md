# Gemini integration diagnosis — 31 October 2026

**Later result:** the same key succeeded with `gemini-3.5-flash-lite`, including real image analysis and semantic matching through ClaimBack. The backend now selects that model. See [successful alternative-model verification](GEMINI_FLASH_LITE_VERIFICATION.md). The findings below describe the earlier Gemini 3.8 investigation.

## Result

**Real API generation remains unsuccessful.** The most specific live error was returned by the official Gemini streaming endpoint:

> HTTP 503 — UNAVAILABLE: This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.

This establishes a provider capacity failure for that request. It does not establish the exact internal cause of every earlier 503/504, nor does it establish a billing or API-key restriction. No 401, 403 or 429 was returned by the generation probes in this follow-up.

The user clarified that the successful independent test was in the **AI Studio prompt playground**, not generated API code using the configured key. Playground success and API-key inference success are different verification results. The backend was not silently using a different key or model in these diagnostic requests.

## Configuration and running-process checks

| Check | Observed result |
| --- | --- |
| Environment file | `server/.env`, resolved relative to `server/src/config/env.js` |
| File key suffix | `KPaw`; full value never printed |
| Effective key suffix | `KPaw`; complete effective value matched the file in memory |
| Inherited `GEMINI_API_KEY` | Absent in the diagnostic/launcher environment |
| `GOOGLE_API_KEY` | Absent after loading the environment file |
| Gemini key definitions | Exactly one |
| Model | `gemini-3.8-flash` |
| Installed SDK | `@google/genai` 1.52.0; package declaration `^1.20.0` resolves to this installed version |
| Runtime | Node v26.3.0 |
| Authentication | Explicit `new GoogleGenAI({ apiKey: env.GEMINI_API_KEY, ... })`; API-key header, not ADC or OAuth |
| Vertex mode | False |
| Endpoint/version | `https://generativelanguage.googleapis.com/`, `v1beta` |
| Custom base URL / proxy environment | None configured |
| Actual restarted backend | Startup log confirmed `configured: true`, model `gemini-3.8-flash`, key suffix `KPaw` |

The installed SDK source confirms that an explicitly supplied `apiKey` takes precedence over its environment fallback. Although the fallback prefers `GOOGLE_API_KEY` when both variables exist, ClaimBack passes its key explicitly and `GOOGLE_API_KEY` was absent here.

User-provided account context: Default Gemini Project, project ID `gen-lang-client-0943173241`, free tier. The key's project association, key restrictions and project eligibility cannot be independently established from a model-metadata response; no authenticated Cloud Console administrative session was used or settings changed.

## Real requests made in this follow-up

All generation prompts were only `Reply with exactly CLAIMBACK_OK.` No tools, images, ownership evidence, accounts or other application data were included. Calls were sequential and bounded; no unbounded retry loop was used.

| Request | Result |
| --- | --- |
| SDK `generateContent`, application-equivalent 20-second timeout | HTTP 504 after 19,114 ms; `DEADLINE_EXCEEDED`, “Deadline expired before operation could complete.” |
| Direct REST `generateContent`, same key/model, without SDK or server-deadline header | No completed response within 60 seconds; client `TimeoutError` after 60,013 ms. This was a local abort, not an observed HTTP 504. |
| SDK `models.get` | Succeeded for `models/gemini-3.8-flash`; advertised `generateContent`, `countTokens`, `createCachedContent`, `batchGenerateContent` |
| SDK `generateContentStream`, same key/model | HTTP 503 after 5,074 ms; explicit model-high-demand message quoted above |

The SDK's `httpOptions.timeout: 20000` also sends a 20-second server-deadline header. The longer direct-REST comparison failed too, and streaming returned a capacity error in about five seconds. Therefore changing only the SDK deadline is not an established fix. The production AI request implementation and timeout were not speculatively rewritten.

## Network and access investigation

- Operating-system DNS lookup resolved both IPv4 and IPv6 addresses for the official endpoint.
- A direct TLS connection completed using TLS 1.3, normal certificate validation and Google Trust Services as issuer. TLS validation was never disabled.
- Authenticated model metadata retrieval succeeded using the configured key.
- The real generation endpoint returned Google's structured high-demand error. No authentication, forbidden-project, disabled-API or quota-exhaustion error was observed.
- Metadata success does not prove generation entitlement. Google's [troubleshooting guide](https://ai.google.dev/gemini-api/docs/troubleshooting) explicitly distinguishes metadata access from inference eligibility. However, the evidence here does **not** justify claiming a restriction or changing billing.

## Actual application issue fixed

The previous development command watched only `src`. Editing `server/.env` did not restart it, so a long-running process could retain older configuration. This is a real reload limitation, but cannot explain the freshly started standalone generation failures above.

Changed the dev command to:

```text
node --watch-path=src --watch-path=.env src/server.js
```

Neither application port had a listener when checked at the start of the live diagnosis. Started root `npm run dev` in the background; the backend loaded the latest key/model and reconnected to Atlas. Startup now emits a safe configuration record with only the key's last four characters, model and configured flag.

Safe provider diagnostics now distinguish fixed `model_capacity` and `deadline_exceeded` reasons without logging raw provider messages, credentials or request bodies. No failure is converted into success and deterministic fallback is still explicitly labelled.

Existing report `AI unavailable` labels are persisted analysis results, not continuous provider-health checks. Changing environment settings does not automatically re-analyze old records. No existing reports, recovery history or user accounts were modified to mask that state.

## Changed files

- `server/package.json`: watch `.env` in development.
- `server/src/server.js`: log safe effective AI configuration at startup.
- `server/src/utils/providerDiagnostics.js`: fixed capacity/deadline reason labels.
- `server/test/providerDiagnostics.test.js`: verify classification and redaction, including nested JSON messages.
- `server/scripts/diagnose-gemini.js`: explicit operator diagnostics; configuration-only by default, real calls require `--confirm-live`; official-endpoint guard and key redaction.
- `README.md` and this report: current results and reload instructions.

No `.env` values, dependencies, MongoDB URI/DNS/TLS configuration, Cloudinary configuration, billing or API keys were changed. No application records were created or modified for these text-only provider probes.

## Validation and remaining work

- Targeted AI/image/diagnostics tests: **6 passed**.
- Complete backend suite: **44 passed, 0 failed**, using the isolated automated test database. Provider success-path tests are mocks and are not evidence of real Gemini generation.
- Diagnostic script syntax and `git diff --check`: passed.
- Frontend: HTTP 200 at `http://127.0.0.1:5173/`.
- Backend readiness: HTTP 200 at `http://127.0.0.1:5000/api/v1/health/ready`, `status: ready`, `database: connected`.
- Both development servers remain running. No frontend source changed, so a new frontend build was not needed for these changes.

Successful live image understanding, structured extraction, description enhancement and semantic scoring remain **unverified**. Their prerequisite minimal text-generation test did not succeed, so further photo uploads and test records were not created.

When provider capacity is available, retry from the project root:

```powershell
# No provider call; prints configuration with the last four key characters only.
node server/scripts/diagnose-gemini.js config
# One real minimal request; no model tools and no application data.
node server/scripts/diagnose-gemini.js text --confirm-live
```

If API failures persist while the playground works, inspect API request/usage errors and key restrictions for `gen-lang-client-0943173241` in the account's console, or report the explicit high-demand/timeout results to Google. A 403/429 or a project-restriction message would provide different evidence; none was observed here. Do not assume that creating another key or enabling billing is required. Once the minimal API request genuinely succeeds, repeat the synthetic application photo-analysis and matching workflow before declaring the integration verified.
