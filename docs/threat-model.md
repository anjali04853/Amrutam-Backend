# Threat Model

## Attack Surface

1. **Public REST API** (`/api/v1/*`) — the primary external surface.
   Reachable by anyone; authentication required on all routes except
   `/auth/register` and `/auth/login`.
2. **Swagger UI** (`/docs`) — exposes the API schema publicly in this
   implementation. In production this should be restricted to internal
   networks or authenticated access, since it details every endpoint's
   shape to an attacker.
3. **Observability endpoints** (`/metrics`, Grafana on :3001, Prometheus
   on :9090, Jaeger UI on :16686) — unauthenticated in the local
   docker-compose setup. In production these must sit behind an internal
   network / VPN / auth proxy, never on the public internet.
4. **Job queue (Redis/BullMQ)** — not directly exposed, but a compromised
   app container with Redis access could enqueue arbitrary jobs; mitigated
   by workers only processing known job names with typed payloads (no
   `eval`-style dynamic job execution).
5. **Database** — not directly exposed; reachable only from the app/worker
   containers within the VPC (Terraform private subnets, Task 21).

## Key Threats & Mitigations

| Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Credential stuffing against `/auth/login` | High | Account takeover | Rate limiting (20/15min), bcrypt hashing defeats offline cracking of leaked hashes, MFA available |
| Double-booking / race condition on slot booking | High (by design, concurrent users) | Data integrity / business logic violation | Row-level `SELECT ... FOR UPDATE` lock inside a DB transaction (Task 11) |
| Duplicate payment/booking from client retry (network blip) | Medium | Double charge / duplicate booking | Required `Idempotency-Key` header, server returns original result on replay |
| An authenticated patient/doctor acting on another party's consultation, prescription, or payment | High | Data integrity / privacy / financial (unauthorized cancellation, prescription issuance, or payment on someone else's resource) | RBAC (route-level role check) **plus** resource-ownership checks enforced in the service layer: `ConsultationsService.transition` requires the actor be the consultation's patient or doctor; `PrescriptionsService.issue` requires the actor be the consultation's assigned doctor; `PaymentsService.pay` requires the actor be the consultation's patient. All three throw `ForbiddenError` (403) otherwise. |
| Admin analytics endpoint abused for live-query DoS | Low | Availability | Reads only pre-aggregated summary rows, never live aggregation (Task 16) |
| Leaked JWT access token | Medium | Session hijack for 15 minutes | Short-lived (15min) access tokens; refresh tokens are rotated and revocable, hashed (SHA-256) at rest so a DB leak doesn't expose usable tokens |
| SQL injection via search query params | Low (Prisma parameterizes) | Data breach | `$queryRawUnsafe` in search uses positional placeholders exclusively, no string interpolation of user input into SQL text |
| Compromised dependency (supply chain) | Medium | Remote code execution | Dependabot + `npm audit` in CI; package-lock.json pinned and committed |
| PII exposure via database backup/snapshot leak | Low | Regulatory/privacy breach | Field-level encryption means a raw DB dump doesn't expose plaintext phone/address/license fields even without RDS-level encryption |
| Payment gateway `forceOutcome` param abused in production | Medium if shipped as-is | Bypasses real payment logic | `forceOutcome` is only read from the request body when `NODE_ENV !== 'production'` (`src/modules/payments/payments.routes.ts`, gated via the typed `loadEnv()` accessor); in production it is stripped server-side regardless of what the client sends. Also documented as demo-only in the OpenAPI spec and README; a production cutover additionally replaces `MockPaymentGateway` with a real adapter that has no such parameter. |
| Client-supplied payment amount | High (pre-fix) | Financial — a patient could pay an arbitrary (e.g. near-zero) amount for any consultation | `amount` is no longer accepted from the client at all (removed from `createPaymentSchema`); `PaymentsService.pay` derives the charged amount server-side from the assigned doctor's `consultationFee` looked up via `PaymentsRepository.findDoctor` |
| A retried payment call for a consultation that already has a payment row (e.g. after a first attempt failed) hits the `Payment.consultationId` unique constraint in `createPending`, which sits outside the gateway try/catch | Low-Medium | Previously: an opaque 500 instead of a clean error, with no compensation running on that path | `PaymentsService.pay` now wraps `createPending` in its own try/catch that detects Prisma's unique-constraint violation (`P2002`) and returns a clean `ConflictError` (409, "A payment already exists for this consultation") instead of an unhandled 500. This does not implement full retry-after-decline as a feature (still out of scope) — it only guarantees the failure mode is a clean, predictable 409 rather than a stuck slot with an opaque error. |
| **Payment-failure saga compensation itself fails** (`markFailed` / `releaseSlot` / the compensation audit write throws inside `PaymentsService.pay`'s inner try/catch, `src/modules/payments/payments.service.ts`) | Low | **Data integrity** — the `AvailabilitySlot` can remain incorrectly `BOOKED` after a payment has failed, blocking that slot from ever being rebooked until manually corrected | The failure is caught and logged via `logger.error` (with `paymentId` and `slotId` for manual follow-up) so it is not silent, and the original payment error still propagates to the caller — but the compensation step itself is **not retried**. This is a known, current gap (also flagged in `docs/architecture.md` Section 8, "Transaction Management & Sagas"); closing it would require either a retry-with-backoff around the compensation block or a periodic reconciliation job that finds `BOOKED` slots with no corresponding `SUCCEEDED` payment and releases them. |
| CORS misconfiguration | Low (internal-facing today) | Cross-origin credential/data leakage | `cors()` is currently applied with default (permissive) settings rather than an explicit origin allowlist (`src/app.ts`) — acceptable for the current public read-heavy surface but should be tightened before any production deployment that uses cookie-based or credentialed cross-origin requests |

## Trust Boundaries

- **Client ↔ API**: untrusted input, always validated (Zod) and
  authenticated/authorized before touching business logic.
- **API ↔ Database**: trusted connection (VPC-internal in production),
  but queries are still parameterized as defense-in-depth against a
  future code change reintroducing raw string interpolation.
- **API ↔ Redis/BullMQ**: trusted connection; job payloads are typed at
  the TypeScript level but not re-validated with Zod on dequeue — noted
  as a hardening opportunity if job producers ever become less trusted
  than the API process itself.
- **API ↔ Mock Payment Gateway**: in this implementation the "gateway" is
  in-process code, so there is no real network trust boundary; a real
  integration would add TLS + webhook signature verification for
  asynchronous payment confirmations.

## Out of Scope (Explicitly)

- DDoS mitigation at the network/CDN layer (would sit in front of the
  ALB in production — e.g. AWS Shield/CloudFront — not implemented here).
- Real payment gateway PCI compliance (payments are mocked).
- Physical security / insider threat controls.
- **Doctor role self-selection at registration**: `POST /auth/register` lets any
  unauthenticated caller choose `role: DOCTOR` with no verification step. This is
  an accepted demo simplification — a real system would gate doctor accounts
  behind an admin-reviewed credential/license verification workflow before
  granting the DOCTOR role.
