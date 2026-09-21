# Production deployment

Domain: **https://medical.vidyarthimitra.org**. The application runs as three processes: Express API, background worker, and the built Node frontend. Redis supports background jobs. Use MongoDB Atlas or a MongoDB replica set; reviewed publishing requires transactions.

## 1. Configure the server

Use Node 24 and npm for direct deployment, or Docker with Compose on a Linux server. Point the domain's DNS to this server and allow inbound HTTP/HTTPS. Keep MongoDB and Redis private. Enable database backups and verify a restore before accepting production imports.

Keep `backend/.env` outside version control. Set `NODE_ENV=production`, the intended `MONGODB_URI`, `REDIS_URL`, and `CORS_ORIGINS=https://medical.vidyarthimitra.org`. Supply two different, randomly generated JWT secrets of at least 32 characters; startup rejects development secrets. Configure Cloudinary for real college image uploads. Existing credentials are not changed by the build.

`TRUST_PROXY=1` is appropriate for the included Nginx configuration, with Express reachable only through that proxy. Leave it empty for direct access. Adapt this setting if your host uses a different proxy topology.

OTP and Razorpay integration include isolated verification tests, transactional activation and recovery. Configure credentials and provider dashboards using [OTP-PAYMENTS.md](OTP-PAYMENTS.md), then verify real delivery and a test payment on the deployed domain. Credentials were left for the owner to supply.

## 2. Build and prepare storage

From the project root on the server:

```sh
docker compose build
docker compose run --rm --no-deps api npm run prepare:production
docker compose up -d
docker compose ps
```

Preparation creates collections and declared indexes, including per-user notification receipts and import locks. It does not seed or delete catalog records. If a unique index is blocked by existing duplicates, correct those records through the admin workflow and retry. Use the intended production database, not a standalone MongoDB.

Compose starts Redis with a persistent volume. API and web ports bind to `127.0.0.1` only; Nginx exposes them through HTTPS. The worker is a separate service so scheduled jobs continue after requests finish. The SSR frontend uses `INTERNAL_API_URL=http://api:5000/api/v1`, while browser requests use the official domain.

The frontend public API URL is compiled during the build. If changing hosts, update the build argument `VITE_API_URL` and rebuild; a runtime-only change does not update browser JavaScript.

## 3. HTTPS and reverse proxy

Provision a TLS certificate for the domain, then install `deploy/nginx.conf` in your Nginx server configuration. The included certificate paths assume Let's Encrypt. Run `nginx -t` before reloading Nginx. Certificate provisioning and DNS are hosting tasks; this repository does not create them.

The proxy preserves `/api/v1/...` paths, supports spreadsheet/image request sizes, and forwards the client IP to the API. Check the homepage, direct college/course links, admin session, import download and a real image upload over the HTTPS domain.

## 4. Direct Node alternative

In `backend`:

```sh
npm ci --omit=dev
npm run prepare:production
npm start
```

Run `npm run worker` as a separate supervised service using the same backend environment. Supply a private Redis service. With one Nginx proxy, set `TRUST_PROXY=1` and firewall the API port.

In `frontend`:

```sh
npm ci
npm run build
HOST=127.0.0.1 PORT=3000 INTERNAL_API_URL=http://127.0.0.1:5000/api/v1 npm start
```

These inline environment commands use a Linux shell. Run both apps and the worker under your host's process supervisor with automatic restart and log retention. Deploy the complete frontend `.output` directory; serving only `.output/public` loses SSR and direct page routing. `npm run dev` is for development.

## 5. Verify and maintain

- `http://127.0.0.1:5000/health` checks the HTTP process; `/ready` returns 200 only when MongoDB is connected. These probes are not rate limited. Redis/worker health should be monitored separately.
- Check `docker compose logs --tail=100 api worker web` for startup or job failures. API responses use `Cache-Control: no-store`; do not configure CDN caching for authenticated/API responses.
- Sign in with the existing admin account. If setting up a new administrator, promote an existing account with `npm run make-admin -- <email-or-phone>` from the backend service.
- Use the eight Excel templates under `samples/imports` or download them in Data entry. Hostel and mess fees are within **Fees**; service bonds remain separate. Publish reviewed data and check the corresponding public pages.
- Retain a previous application release and a verified database backup for rollback. Production preparation is additive; never use `syncIndexes`, demo seeds, or test databases as a migration strategy.

## Verification scope

Local checks cover TypeScript, lint, the Node production build, isolated MongoDB integration tests and Chrome browser tests with mocked APIs. Source regression tests are intentionally retained; fixture records never enter the application database. Generated browser reports, obsolete scaffolding and the downloaded test MongoDB cache can be removed after checks. Useful Excel formats and the official course-master workbook remain.

The Docker/Nginx configuration must still be exercised on the Linux host: Docker and Nginx are not installed in the development workspace. A successful local build is not a deployment, TLS check, or OTP/payment provider verification.
