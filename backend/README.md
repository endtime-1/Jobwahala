# JobWahala Backend

This is the Node.js + Express backend for JobWahala, serving seekers, employers, freelancers, and admins. It uses Prisma for persistence and now includes production-oriented runtime guardrails such as env validation, security headers, rate limiting, request logging, health checks, graceful shutdown, and a PostgreSQL production schema.

## Setup Instructions

### 1. Install Dependencies
Run the following from the `backend/` directory:
```bash
npm install
```

### 2. Environment Variables
Create a `.env` file in the `backend/` directory (a `.env.example` is provided):
```env
NODE_ENV=development
PORT=5000
DATABASE_URL="file:./dev.db"
# Production example:
# DATABASE_URL="postgresql://jobwahala:replace-me@localhost:5432/jobwahala?schema=public"
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="7d"
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-5"
ADMIN_EMAIL=""
ADMIN_PASSWORD=""
FRONTEND_BASE_URL="http://localhost:5173"
PAYMENT_PROVIDER="SANDBOX"
PAYMENT_DEFAULT_CURRENCY="GHS"
PAYSTACK_SECRET_KEY=""
PAYSTACK_PUBLIC_KEY=""
EVIDENCE_STORAGE_PROVIDER="LOCAL"
EVIDENCE_STORAGE_LOCAL_DIR="uploads"
EVIDENCE_STORAGE_PREFIX="evidence"
EVIDENCE_STORAGE_S3_BUCKET=""
EVIDENCE_STORAGE_S3_REGION=""
EVIDENCE_STORAGE_S3_ENDPOINT=""
EVIDENCE_STORAGE_S3_PUBLIC_BASE_URL=""
EVIDENCE_STORAGE_S3_ACCESS_KEY_ID=""
EVIDENCE_STORAGE_S3_SECRET_ACCESS_KEY=""
EVIDENCE_STORAGE_S3_FORCE_PATH_STYLE="false"
CORS_ALLOWED_ORIGINS="http://localhost:5173"
TRUST_PROXY="false"
BODY_LIMIT="8mb"
REQUEST_TIMEOUT_MS="30000"
AUTH_RATE_LIMIT_WINDOW_MS="900000"
AUTH_RATE_LIMIT_MAX="20"
API_RATE_LIMIT_WINDOW_MS="60000"
API_RATE_LIMIT_MAX="240"
LOG_REQUESTS="true"
```

### 3. Database Setup (Prisma)
With the backend dependencies installed, scaffold the local SQLite tables:
```bash
npx prisma generate
npx prisma db push
```

Generate the PostgreSQL client and deploy SQL migrations for production:
```bash
npm run prisma:generate:postgres
npm run prisma:migrate:deploy:postgres
```

### 4. Running the Server
You can run the server in development mode natively if TS is configured:
```bash
npx ts-node-dev src/index.ts
```
The server will start at `http://localhost:5000`

Health endpoints:
```bash
GET /health
GET /ready
```

### 5. Local Quality Checks
Run the backend smoke test against an isolated temporary SQLite copy:
```bash
npm run smoke:test
```

Bootstrap an admin account with explicit credentials:
```bash
ADMIN_EMAIL="admin@example.com" ADMIN_PASSWORD="change-me" npm run bootstrap:admin
```
`bootstrap:admin` now requires both env vars and will not fall back to a hard-coded password.

## Production Notes

- `JWT_SECRET` and `CORS_ALLOWED_ORIGINS` are required for production.
- `FRONTEND_BASE_URL` should point to the public frontend URL so payment callbacks can return users to `/agreements`.
- `PAYMENT_PROVIDER=PAYSTACK` enables live checkout initialization and verification through Paystack; leave it as `SANDBOX` for local/dev smoke runs.
- Evidence uploads default to `EVIDENCE_STORAGE_PROVIDER=LOCAL` for development. For multi-instance production, switch to `S3` and provide the bucket, credentials, region, and public base URL env vars.
- The backend now returns `X-Request-Id` on responses and includes request logging when `LOG_REQUESTS=true`.
- Auth and general API routes are rate-limited in memory. This is acceptable for a single-instance deployment but should be replaced with a shared store when you scale horizontally.
- Local development and the backend smoke test still use SQLite for speed.
- Production Docker now targets PostgreSQL through `prisma/schema.postgresql.prisma`.
- `docker-compose.production.yml` provisions PostgreSQL storage and passes a PostgreSQL `DATABASE_URL` into the backend.
- `docker-compose.production.yml` also includes a `postgres-backup` sidecar that writes scheduled dumps to a Docker volume.
- Set `POSTGRES_PASSWORD` before running the production compose stack.

## Docker

Build and run the backend container:
```bash
docker build -t jobwahala-api .
docker run --env-file .env -e DATABASE_URL="postgresql://jobwahala:replace-me@db:5432/jobwahala?schema=public" -p 5000:5000 jobwahala-api
```

## Connecting to Frontend (Vite/React)
In your frontend `c:\Users\Gabriel Kwaku Kusi\Downloads\JobWahala`, modify your `.env` or configurations to target:
```env
VITE_API_URL=/api
```
For local Vite development, `/api` is proxied to `http://localhost:5000`.

## API Route Structure

### Authentication
- `POST /api/auth/register` (body: email, password, role)
- `POST /api/auth/login` (body: email, password)
- `GET /api/auth/me` (Protected - Returns active profile data)

### Users / Profiles
- `GET /api/users/profile` (Protected - Retrieve specific sub-profile details)
- `PUT /api/users/profile` (Protected - Update logged in user profile)

### Jobs & Applications
- `GET /api/jobs` (List all positions)
- `GET /api/jobs/:id` (Single position)
- `POST /api/jobs` (Protected EMPLOYER - Create job)
- `POST /api/jobs/:id/apply` (Protected SEEKER - Create application)
- `GET /api/jobs/:id/applicants` (Protected EMPLOYER - Review candidates)

### Freelance Services
- `GET /api/services` (Browse gig listings with `?category=x&skills=y,z` filters)
- `GET /api/services/freelancer/:id` (Publicly view a freelancer profile and their active gigs)
- `POST /api/services` (Protected FREELANCER - Offer new gig)
- `PUT /api/services/:id` (Protected FREELANCER - Edit gig)
- `DELETE /api/services/:id` (Protected FREELANCER - Remove gig)

### Messaging
- `GET /api/messages` (Protected - Inbox with unread counts)
- `POST /api/messages` (Protected - Send message & auto-create thread)
- `GET /api/messages/:id` (Protected - Fetch complete message thread)
- `PATCH /api/messages/:id/read` (Protected - Mark received messages in thread as read)

### CV Generator
- `POST /api/cv` (Protected SEEKER - Trigger provider-backed AI generation when `content` is omitted, or manually save output)
- `GET /api/cv` (Protected SEEKER - Fetch past generated CVs)
- `GET /api/cv/:id` (Protected SEEKER - Retrieve a specific generated CV)

### Administration
- `GET /api/admin/reports` (Protected ADMIN - Moderation queue)
- `GET /api/admin/users` (Protected ADMIN - List all users)
- `GET /api/admin/jobs` (Protected ADMIN - List all jobs)
- `GET /api/admin/services` (Protected ADMIN - List all freelance services)
- `PATCH /api/admin/users/:id/status` (Protected ADMIN - Update status to ACTIVE, FLAGGED, SUSPENDED)
- `PATCH /api/admin/jobs/:id/status` (Protected ADMIN - Update job status)
- `PATCH /api/admin/services/:id/status` (Protected ADMIN - Update service status)
- `DELETE /api/admin/users/:id` (Protected ADMIN - Banish user)

### Agreements & Payments
- `POST /api/agreements/:id/milestones/:milestoneId/payments` (Protected payer - open a payment session)
- `POST /api/agreements/:id/payments/:paymentId/verify` (Protected participant - verify an external provider payment after redirect)
- `POST /api/payments/webhooks/paystack` (Public webhook - settles successful Paystack charges)
