# Security Checklist

## OWASP Top 10 (2021) Mitigation

| Risk | Mitigation | Where |
|---|---|---|
| A01 Broken Access Control | `requireAuth` + `requireRole` middleware on every mutating/sensitive route; resource-ownership enforced in the service layer — `ConsultationsService.transition` only allows the consultation's own patient/doctor to change its status, `PrescriptionsService.issue` only allows the consultation's assigned doctor to issue a prescription for it, and `PaymentsService.pay` only allows the consultation's own patient to pay for it (all three throw `ForbiddenError`/403 otherwise) | `src/common/middleware/auth.ts`, `rbac.ts`, `src/modules/consultations/consultations.service.ts`, `src/modules/prescriptions/prescriptions.service.ts`, `src/modules/payments/payments.service.ts` |
| A02 Cryptographic Failures | Passwords via bcrypt (12 rounds); PII (phone, address, license number, MFA secret) encrypted at rest with AES-256-GCM; JWT secrets and encryption key via env vars, never hardcoded | `src/common/crypto/field-encryption.ts`, `auth.service.ts` |
| A03 Injection | Prisma parameterized queries everywhere except the search module's raw SQL, which uses `$queryRawUnsafe` with positional `$1, $2...` placeholders (never string-interpolated values) | `src/modules/search/search.repository.ts` |
| A04 Insecure Design | Idempotency keys required on booking/payment writes; consultation state machine rejects illegal transitions; saga compensation on payment failure; payment amount is always server-derived from the doctor's `consultationFee`, never client-supplied; the `forceOutcome` test-only gateway override is only honored when `NODE_ENV !== 'production'` | `booking.service.ts`, `consultations.service.ts`, `payments.service.ts`, `payments.routes.ts` |
| A05 Security Misconfiguration | `helmet()` security headers, `.env` gitignored with `.env.example` committed, no default credentials in production paths | `src/app.ts` |
| A06 Vulnerable Components | Dependabot weekly scans (npm, Docker, GitHub Actions); `npm audit --audit-level=high` in CI | `.github/dependabot.yml`, `.github/workflows/ci.yml` |
| A07 Identification & Auth Failures | bcrypt password hashing, JWT access tokens (15min expiry) + rotated refresh tokens (SHA-256 hashed at rest), TOTP MFA, rate-limited `/auth/*` endpoints | `src/modules/auth/`, `rate-limit.ts` |
| A08 Software & Data Integrity | CI runs lint + typecheck + tests before building the Docker image; no unpinned `latest` tags in production dependencies (package-lock.json committed) | `.github/workflows/ci.yml` |
| A09 Security Logging & Monitoring Failures | Structured JSON logs via pino, shipped to Loki; every mutating action on booking/consultations/prescriptions/payments writes an audit_log row (actor, action, resource, before/after, IP address); OpenTelemetry traces for request flow visibility | `src/observability/logger.ts`, `src/modules/audit/` |
| A10 Server-Side Request Forgery | No user-supplied URLs are fetched server-side anywhere in this system (the payment gateway is a local mock, not a user-controllable endpoint) | N/A by design |

**Note on A05**: `cors()` is currently applied with default (permissive, allow-all-origins)
settings rather than an explicit allowlist — see `src/app.ts`. This is acceptable for a
public read-heavy API surface but should be tightened to an explicit origin allowlist
before any production deployment that relies on cookie-based or credentialed requests.

## Data Classification

| Data | Classification | Handling |
|---|---|---|
| Password hashes | Secret | bcrypt, never logged, never returned in API responses |
| MFA secrets | Secret | AES-256-GCM encrypted at rest |
| Phone, address | PII | AES-256-GCM encrypted at rest |
| License numbers | PII / Regulated | AES-256-GCM encrypted at rest |
| Consultation content, prescriptions | Sensitive (health data) | Access restricted to patient/doctor party + admin audit review; audit-logged on every write |
| Payment amounts, provider refs | Sensitive (financial) | No card data stored (mocked gateway, out of PCI scope); audit-logged |
| Audit logs | Internal / Compliance | Append-only, admin-read-only, partitioned by month |

## Encryption & Key Rotation

- **At rest**: AES-256-GCM for PII fields at the application layer (see
  `field-encryption.ts`); RDS storage encryption at the infra layer
  (Terraform, Task 21).
- **In transit**: TLS terminated at the load balancer in production
  (documented in Terraform); ElastiCache Redis transit encryption enabled.
- **Key management**: `ENCRYPTION_KEY` is a single static key sourced
  from an env var in this implementation — documented explicitly as a
  simplification. Production hardening: migrate to AWS KMS with envelope
  encryption (data encrypted with a per-record data key, data key
  encrypted with a KMS customer master key), enabling key rotation without
  re-encrypting all existing rows, and scoped IAM access to the KMS key.

## Audit Log Coverage

Every mutating call to booking, consultations, prescriptions, and payments
passes through `AuditService.record()` (see
`src/modules/audit/audit.service.ts`), capturing actor, action, resource
type/id, before/after state, and IP address (threaded from `req.ip` in each
route handler down through the corresponding service method). Audit logs
are queryable by an ADMIN role only via `GET /api/v1/admin/audit-logs`.

## Dependency Scanning

- Dependabot configured for npm, Docker base images, and GitHub Actions
  (weekly).
- `npm audit --audit-level=high` runs in CI on every push/PR.

## Rate Limiting & Input Validation

- All routes validate input via Zod schemas before reaching the service
  layer (`validate()` middleware).
- Redis-backed sliding-window rate limiting: stricter on `/auth/*` (20
  req/15min) to blunt credential-stuffing/brute-force attempts, looser on
  general reads (300 req/min) and writes (60 req/min).
