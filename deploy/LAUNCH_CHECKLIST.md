# VPS Launch Checklist

1. Set root deploy variables in `.env.vps`.
2. Set backend secrets in `backend/.env`.
   Include `EVIDENCE_STORAGE_PROVIDER`. For single-host local evidence storage, keep `LOCAL`. For object storage, set `S3` plus the bucket/public URL credentials.
3. Point DNS for `DOMAIN` to the VPS public IP.
4. Run `npm run deploy:check:vps` locally before the first deploy.
5. Bring the stack up with `docker compose --env-file .env.vps -f docker-compose.vps.yml up -d --build`.
6. Run `npm run deploy:verify -- https://your-domain`.
7. Bootstrap the admin account with explicit `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
8. Log in as admin and verify reports, users, jobs, and services screens.
9. Test signup, onboarding, job posting, application, agreements, and messaging in the live domain.
10. Confirm backups are being written in the `postgres_backups` volume and copied off-host by your infrastructure process.
11. If `EVIDENCE_STORAGE_PROVIDER=LOCAL`, confirm files appear in the `evidence_uploads` Docker volume. If `S3`, confirm uploaded evidence resolves from the public object URL.
