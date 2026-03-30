# Railway Deploy

This repo can be deployed to Railway as three services inside one project:

1. `postgres` (Railway PostgreSQL service)
2. `api` (backend from `backend/`)
3. `web` (frontend from repo root)

The frontend container proxies `/api`, `/health`, and `/ready` to the backend over Railway private networking, so the backend can stay private.

## Recommended Layout

- `postgres`
  - Create a Railway PostgreSQL service.
- `api`
  - Root directory: `backend`
  - Builder: Dockerfile
  - Keep private unless you specifically need a direct public backend URL.
- `web`
  - Root directory: repo root
  - Builder: Dockerfile
  - Public service

## Backend Service Env

Set these in the Railway `api` service:

```env
NODE_ENV=production
PORT=5000
JWT_SECRET=replace-with-a-strong-secret
JWT_EXPIRES_IN=7d
CORS_ALLOWED_ORIGINS=https://your-web-domain.up.railway.app
DATABASE_URL=${{Postgres.DATABASE_URL}}
EVIDENCE_STORAGE_PROVIDER=LOCAL
```

Also set any feature-specific secrets you are using:

- `OPENAI_API_KEY`
- `PAYMENT_PROVIDER`
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_PUBLIC_KEY`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- S3 evidence storage env vars if you switch away from local storage

Notes:

- The backend Docker image already runs PostgreSQL migrations on startup.
- For beta launch, `EVIDENCE_STORAGE_PROVIDER=LOCAL` is fine on a single Railway instance.
- For multi-instance production, move evidence to S3-compatible object storage.

## Frontend Service Env

Set this in the Railway `web` service:

```env
BACKEND_UPSTREAM=api.railway.internal:5000
```

Notes:

- Leave `VITE_API_URL` unset for this layout.
- The frontend will use same-origin `/api`, and Nginx will proxy that traffic to the private backend service.
- If you prefer a separate public backend URL instead of the proxy model, set `VITE_API_URL=https://your-api-domain.up.railway.app/api` at build time and remove the need for `BACKEND_UPSTREAM`.

## Deploy Steps

1. Create a new Railway project.
2. Add a PostgreSQL service.
3. Add the backend service from this repo with root directory `backend`.
4. Add the frontend service from this repo with root directory `.`.
5. Set the backend env vars.
6. Set `BACKEND_UPSTREAM=api.railway.internal:5000` on the frontend service.
7. Deploy both services.
8. Open the public `web` domain.

## Health Checks

- Frontend public health path: `/health`
- Frontend public readiness path: `/ready`
- Backend internal health path: `/health`
- Backend internal readiness path: `/ready`

## Beta Launch Recommendation

For a low-cost beta:

- keep `api` private
- expose only `web`
- use Railway Postgres
- keep evidence storage local
- keep payments in sandbox mode
- bootstrap one admin account after the first deploy

## After First Deploy

Run the admin bootstrap from the backend service shell or Railway CLI:

```bash
ADMIN_EMAIL="admin@example.com" ADMIN_PASSWORD="change-me" npm run bootstrap:admin
```

Then test:

1. signup
2. onboarding
3. job posting
4. application
5. proposals
6. agreements
7. admin moderation

