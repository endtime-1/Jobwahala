# JobWahala

JobWahala is an AI-powered job and freelance platform built with a React/Vite frontend and an Express/Prisma backend.

## Repo Structure

- `src/` contains the frontend app, routes, dashboards, API client, and shared UI.
- `backend/src/` contains the API, auth, moderation, messaging, agreement logic, and Prisma-backed persistence.
- `backend/prisma/` contains the local SQLite schema plus the PostgreSQL production schema and migrations.
- `.github/workflows/ci.yml` runs frontend build checks plus backend typecheck and smoke testing.

## Current Product Areas

- Auth and onboarding for seekers, employers, freelancers, and admins.
- Job posting, applications, hiring flow, and agreement creation.
- Freelance services, service requests, and agreement tracking.
- Messaging, reporting, CV generation history, and moderation tools.
- Role-based dashboards for seeker, employer, freelancer, and admin workflows.

## Local Development

### Frontend

From the repo root:

```bash
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`.

### Backend

From `backend/`:

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

The backend runs on `http://localhost:5000`.

Frontend API target:

```env
VITE_API_URL=/api
```
If `VITE_API_URL` is omitted, the frontend now defaults to `/api`. Local Vite development proxies that path to the backend on `http://localhost:5000`.

## Quality Checks

Frontend:

```bash
npm run test:smoke
npm run build
```

Backend:

```bash
cd backend
npm run typecheck
npm run smoke:test
```

## Single-Host Production Deploy

The repo now includes a production compose stack with PostgreSQL:

```bash
cp .env.production.example .env
# set POSTGRES_PASSWORD in .env
docker compose -f docker-compose.production.yml up --build
```

- `postgres` provides the production database volume
- `postgres-backup` writes scheduled dumps to the `postgres_backups` volume
- the frontend is served by Nginx from `Dockerfile`
- `/api`, `/health`, and `/ready` are proxied to the backend through `docker/nginx.conf`
- the backend image is defined in `backend/Dockerfile`
- the backend container runs PostgreSQL migrations on startup using `prisma/schema.postgresql.prisma`
- the compose entrypoint is `docker-compose.production.yml`

## VPS Deploy With HTTPS

For a real VPS deployment with automatic TLS:

```bash
cp .env.vps.example .env.vps
# set DOMAIN, LETSENCRYPT_EMAIL, and POSTGRES_PASSWORD in .env.vps
# set backend/.env with JWT_SECRET, CORS_ALLOWED_ORIGINS=https://your-domain, evidence storage config, and other backend secrets
npm run deploy:check:vps
docker compose --env-file .env.vps -f docker-compose.vps.yml up -d --build
npm run deploy:verify -- https://your-domain
```

- `caddy` terminates HTTPS and proxies traffic to the internal `web` container
- `web`, `api`, and `postgres` stay private inside the Docker network
- the VPS stack keeps scheduled Postgres backups enabled
- the API container now persists local evidence uploads on the `evidence_uploads` volume; switch to `EVIDENCE_STORAGE_PROVIDER=S3` in `backend/.env` for object storage
- `.github/workflows/deploy-vps.yml` provides a manual GitHub Actions SSH deploy path
- GitHub Actions deploy secrets expected: `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, and `DEPLOY_PATH`
- Optional GitHub Actions verification secret: `PRODUCTION_URL`
- Launch runbook: [deploy/LAUNCH_CHECKLIST.md](./deploy/LAUNCH_CHECKLIST.md)

## Railway Deploy

For a lower-cost beta launch on Railway:

- create `postgres`, `api`, and `web` services in one Railway project
- point the backend service at the Railway PostgreSQL `DATABASE_URL`
- keep the backend private
- set `BACKEND_UPSTREAM=api.railway.internal:5000` on the frontend service
- expose the frontend service publicly

Full guide: [deploy/RAILWAY.md](./deploy/RAILWAY.md)

## Admin Bootstrap

To create or reset a local admin account, set explicit credentials and run:

```bash
cd backend
ADMIN_EMAIL="admin@example.com" ADMIN_PASSWORD="change-me" npm run bootstrap:admin
```

## More Detail

- Backend setup and API details: [backend/README.md](./backend/README.md)

## Production Hardening Status

The current codebase includes:

- frontend smoke coverage and production build checks
- backend smoke coverage, typecheck, and CI
- backend health/readiness endpoints
- validated backend env loading
- CORS allowlisting, security headers, request logging, and in-memory rate limiting
- graceful backend shutdown and response request IDs

The repo is now prepared for PostgreSQL-backed production. Local development and smoke tests still use SQLite for speed. The included compose stack now adds persistent Postgres storage, scheduled logical backups, health checks, and migration-based startup. Before a public launch, the main remaining work is host-specific: centralized logs/monitoring, HTTPS/TLS termination, external secret management, and off-host backup retention.
