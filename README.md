# Amrutam Telemedicine Backend

Production-grade backend for Amrutam's telemedicine platform: auth + RBAC
+ MFA, doctor availability/booking (concurrency-safe, idempotent), the
consultation lifecycle, prescriptions, mocked payments with saga
compensation, search, compliance audit trails, and admin analytics.

See `docs/architecture.md` for the full architecture, `docs/security-checklist.md`
and `docs/threat-model.md` for security, and `docs/openapi.yaml` (served at
`/docs`) for the API schema.

## Prerequisites

- Node.js 20+
- Docker + Docker Compose

## Quick Start (full stack via Docker Compose)

```bash
cp .env.example .env   # edit secrets if desired; defaults work for local dev
docker compose up -d --build
docker compose exec app npx prisma migrate deploy
```

This starts: the API (`:3000`), worker process, PostgreSQL, Redis,
Prometheus (`:9090`), Grafana (`:3001`, login `admin`/`admin`), Loki,
Promtail, and Jaeger (`:16686`).

- API: http://localhost:3000
- Swagger UI: http://localhost:3000/docs
- Health check: http://localhost:3000/health
- Grafana dashboards: http://localhost:3001 (pre-provisioned "Amrutam API Overview" dashboard)
- Jaeger traces: http://localhost:16686

All API routes are versioned under `/api/v1` (e.g. `/api/v1/auth/register`,
`/api/v1/bookings`) — see `docs/openapi.yaml` or `/docs` for the full list.
`/health` and `/docs` themselves are unversioned.

## Local Development (without full Docker stack)

```bash
npm install
docker compose -f docker-compose.dev.yml up -d   # Postgres + Redis only
cp .env.example .env
npx prisma migrate dev
npm run dev      # API with hot reload
npm run worker    # in a second terminal, background job worker
```

## Running Tests

```bash
docker compose -f docker-compose.dev.yml up -d   # tests need real Postgres+Redis
npm test              # unit + integration tests
npm run lint
npm run typecheck
```

The most important test is
`tests/integration/booking.concurrency.integration.test.ts`, which fires
two simultaneous booking requests at the same availability slot and
asserts exactly one succeeds (201) and the other gets a clean conflict
(409) — proving the row-level locking strategy actually prevents
double-booking under real concurrency, not just in theory.

## Infrastructure as Code

- `docker-compose.yml` — the full local stack (actually run for this
  submission).
- `infra/terraform/` — AWS production target (VPC, Multi-AZ RDS Postgres,
  ElastiCache Redis, ECS Fargate). **Written but not applied** — see
  `infra/terraform/README.md` for why and how to validate/apply it with
  your own AWS credentials.

## Suggested Demo Script (for recording the 5-minute video)

1. `docker compose up -d --build` — show the stack coming up.
2. Open `/docs` — walk through the API surface.
3. Register a doctor (`POST /api/v1/auth/register`), create a profile,
   add availability slots.
4. Register a patient, search for the doctor
   (`GET /api/v1/search/doctors`), book a slot
   (`POST /api/v1/bookings`) with an `Idempotency-Key` header.
5. Replay the exact same booking request with the same `Idempotency-Key`
   — show it returns the same booking, not a duplicate.
6. Transition the consultation `SCHEDULED → IN_PROGRESS → COMPLETED`,
   then issue a prescription — mention the async PDF/notification jobs
   firing in the worker logs.
7. Call `POST /api/v1/payments` with `forceOutcome: "fail"` — show the
   payment failing, the slot being released (saga compensation), and the
   audit log entry recording the compensation via
   `GET /api/v1/admin/audit-logs` (as an admin user).
8. Open Grafana — show the "Amrutam API Overview" dashboard with live
   p95 latency and request-rate panels from the traffic just generated.
9. Open Jaeger — show a trace for one of the booking requests spanning
   the Express handler → Prisma query.
10. Briefly show `docs/architecture.md` and mention the Terraform IaC
    (not applied) and the CI pipeline (`.github/workflows/ci.yml`).

## Environment Variables

See `.env.example`. All secrets are supplied via env vars — never
hardcoded, never committed (`.env` is gitignored).

## Project Structure

See `docs/architecture.md` §1 and the module layout under `src/modules/`.
Each module is self-contained: `*.routes.ts` → `*.service.ts` →
`*.repository.ts`, with Zod validation and RBAC enforced at the route
layer before any business logic runs.
