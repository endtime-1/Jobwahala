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
FRONTEND_BASE_URL=https://your-web-domain.up.railway.app
DATABASE_URL=${{Postgres.DATABASE_URL}}
EVIDENCE_STORAGE_PROVIDER=LOCAL
```

`FRONTEND_BASE_URL` is required in production. Email verification links, password-reset links and the Paystack payment return URL are all built from it, and it defaults to `http://localhost:5173` when unset.

Email needs SMTP, otherwise new users cannot verify their account and login returns 403:

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@your-domain
```

Phone sign-up, phone log-in and phone confirmation for employer verification send one-time codes by SMS through Arkesel. Without these, those buttons show "We could not send the code" and email sign-up keeps working:

```env
SMS_PROVIDER=ARKESEL
ARKESEL_API_KEY=
ARKESEL_SENDER_ID=JobWahala
```

Register the sender name with Arkesel first (11 characters at most). `SMS_PROVIDER=CONSOLE` only prints codes in the log and is refused in production.

Sign-up, the freelance waitlist and reporting are protected by Cloudflare Turnstile (a bot check). Create a Turnstile widget in the Cloudflare dashboard, then set the secret on the backend and the public site key on the website service (it is baked in at build time, so redeploy after adding it):

```env
# backend service
TURNSTILE_SECRET_KEY=
# website (frontend) service
VITE_TURNSTILE_SITE_KEY=
```

**Set both before launch.** With no secret in production the protected forms stay closed (they answer "temporarily unavailable"), on purpose, so the check can never be silently off. If only the site key is missing, people cannot get past the form.

"Continue with Google" needs a Google OAuth client (Google Cloud Console -> APIs & Services -> Credentials -> OAuth client ID, type Web application; add your site address under Authorised JavaScript origins). Use the same client id on both services; leave both empty to hide the button. The website value is baked in at build time, so redeploy after adding it:

```env
# backend service
GOOGLE_CLIENT_ID=
# website (frontend) service
VITE_GOOGLE_CLIENT_ID=
```

An account made with email and password, or a phone number, is linked to Google automatically when the person signs in with Google using the same verified email.

WhatsApp channel links (footer and dashboards) are also baked into the website at build time. Create the channels in WhatsApp, then set the links on the website service. A link that is empty, or still has REPLACE in it, is not shown:

```env
VITE_WHATSAPP_CHANNEL_URL=https://whatsapp.com/channel/...   # optional: the main channel (a default is built in)
VITE_WHATSAPP_CHANNEL_JOBS=https://whatsapp.com/channel/...
VITE_WHATSAPP_CHANNEL_INTERNSHIPS=https://whatsapp.com/channel/...
VITE_WHATSAPP_CHANNEL_EMPLOYERS=https://whatsapp.com/channel/...
```

Errors are reported to Sentry, with personal data removed first. Both are optional; leave them empty to turn reporting off:

```env
# backend service
SENTRY_DSN=
# website (frontend) service, baked in at build time
VITE_SENTRY_DSN=
```

Billing (featured jobs, job boosts, packs, plans and featured courses) uses Paystack too. On the backend service set `PAYSTACK_SECRET_KEY` to your TEST secret key (`sk_test_...`) while you try it out; the Billing page shows a "Test mode" banner until you switch to a live key (`sk_live_...`). In the Paystack dashboard (Settings, API Keys & Webhooks) set the webhook URL to `https://your-web-domain/api/billing/webhooks/paystack`. Every payment is also checked with Paystack directly, so a webhook that never arrives only delays the purchase, it never loses it. Prices, durations, what each product includes, VAT and your company details on receipts are all changed in the admin Billing tab, with no code change.

For live freelance escrow payments set `PAYMENT_PROVIDER=PAYSTACK`, the Paystack keys, and point the Paystack dashboard webhook at `https://your-web-domain/api/payments/webhooks/paystack`. Ghana cedi checkouts offer mobile money first, so enable mobile money on the Paystack account.

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

- Leave `VITE_API_URL` unset for this layout (the Docker build now defaults to same-origin `/api`). If the service already has `VITE_API_URL` set, for example to a public API domain, that value is used instead.
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


## Email on Railway (Hobby and Trial plans block SMTP)

Railway's cheaper plans block the usual mail ports, so SMTP calls time out ("Connection timeout" in the logs). Send email over HTTPS with Brevo's web API instead: on the backend service set `BREVO_API_KEY` (Brevo, SMTP & API, API Keys, Generate a new API key) and `SMTP_FROM=noreply@your-domain`. When `BREVO_API_KEY` is set it is used instead of SMTP. Authenticate your domain in Brevo first (Senders, Domains & Dedicated IPs).

## Uploads survive deploys

Attach a Railway Volume to the backend service (mount path `/data`) and set `EVIDENCE_STORAGE_LOCAL_DIR=/data/uploads`. Without a volume every deploy erases uploaded logos, CVs and verification documents.
