# MedPath by Vidyarthi Mitra

Medical college discovery and counselling platform with a React/TanStack Start frontend and an Express/MongoDB backend.

## Brand and production domain

The product is **MedPath**, with **by Vidyarthi Mitra** beneath the name. The production website is **https://medical.vidyarthimitra.org**. Shared brand settings live in `frontend/src/lib/brand.ts` and `backend/src/config/brand.js`. The header, footer, authentication screens, admin console, checkout and OTP emails use this identity; page titles, canonical URLs and social sharing metadata use the official domain.

The original company logo is stored locally in `frontend/public/brand/vidyarthi-mitra.png`, sourced from [Vidyarthi Mitra's official logo](https://www.vidyarthimitra.org/static/logo.png). The shared logo displays MedPath above a small "by" and this original company image, including on dark backgrounds where the image keeps a white backing. Checkout and OTP emails also use the company image. A reusable `medpath-logo.svg` embeds this same image. Run `npm run brand:assets` from the frontend to regenerate the wordmark and social preview (requires local Chrome on Windows or Playwright Chromium elsewhere). The user-provided `frontend/public/favicon.ico` is preserved.

Production builds read the public API URL from `frontend/.env.production`: `https://medical.vidyarthimitra.org/api/v1`. Hosting must serve the frontend on this domain and forward `/api/` to Express, preserving the path. Keep local development on the localhost API. A hosting environment variable can override Vite's file setting, so set `VITE_API_URL` to the same production URL in the hosting dashboard too. Include `https://medical.vidyarthimitra.org` in the deployed backend's `CORS_ORIGINS`.

DNS and HTTPS must be configured at the domain/hosting provider; these code changes do not publish the site. Update enabled authentication/payment providers to the deployed domain, including the Razorpay webhook URL `https://medical.vidyarthimitra.org/api/v1/billing/webhook/razorpay`. Keep your verified SMTP sender address; only its display name should be `MedPath by Vidyarthi Mitra`. The sitemap covers the public entry pages; individual catalog pages remain discoverable through website links.

## Run locally

```sh
cd backend
npm install
# Copy .env.example to .env and configure the services.
npm run dev
```

In another backend terminal, run `npm run worker` for subscription expiry and temporary slot release jobs.

```sh
cd frontend
npm install
# Set VITE_API_URL in .env (default http://localhost:5000/api/v1).
npm run dev
```

Use the frontend URL printed by Vite.

## Admin console

The public **Courses** page includes a searchable healthcare catalogue after Class 12, with nursing, pharmacy, rehabilitation and allied-health pathways. The [50-course master workbook](samples/catalogue/medical-courses-after-12th.xlsx) contains official source links and stable course slugs for college-course Excel uploads. See [catalogue instructions](samples/catalogue/README.md) for the safe, repeatable import command. Fees appear only when real college-linked records are published; course masters do not create college seats or cutoff ranks.

Run `npm run prepare:imports` in the backend once before using the new draft workflow (MongoDB replica set / Atlas required). This creates additive import storage and indexes.

See **[ADMIN-GUIDE.md](ADMIN-GUIDE.md)** for account promotion, Excel/CSV formats, import order, Cloudinary uploads, permissions, operational features and the production handoff.

- Admin-aware desktop/mobile navigation with login, account and logout state.
- 7/30/90-day analytics with revenue/activity charts and catalog completeness counts.
- Searchable, paginated college/course/cutoff/fee/seat administration, editing and page exports.
- Excel/CSV and manual drafts, saved column mappings, stable college codes, row corrections, approval and atomic publishing.
- Eight downloadable Excel templates, source-file history and restricted data-entry accounts.
- Cloudinary image uploads into reviewed college drafts, with gallery order and public image display.
- Student activation, coupons, paid plans, counsellors, services, availability slots and real booking meeting URLs.
- Audit history and Site settings for team access, service status and verified student-dashboard deadlines.

## Validation

Backend: `npm test`, `npm run test:integration`, and `npm run check:services` for read-only provider connectivity checks.

Frontend: `npm run typecheck`, `npm run build`, and `npm run test:e2e`. Browser tests use Chrome on Windows and Chromium elsewhere; they mock API responses and never mutate a production database.

## Preparing your environment

The demo launcher, demo database, sample catalog seed scripts and hardcoded frontend records have been removed. Website records now come from your configured API/database. Import templates in `samples/imports` and placeholders inside admin forms remain available to guide real data entry; they are never published automatically.

Use npm and the committed `package-lock.json` files (`npm ci` for a reproducible install). Copy `.env.example` only when creating a new environment; preserve existing credentials. Promote an existing account with `npm run make-admin -- <email-or-phone>`, run `npm run prepare:imports` against your intended MongoDB replica set, then enter data through the reviewed import workflow. Configure plans, services and counsellors in the admin panel.

Before public launch, follow the production handoff in [ADMIN-GUIDE.md](ADMIN-GUIDE.md): production environment settings, actual OTP delivery, payment checkout/webhook recovery, image uploads and deployed infrastructure require verification in your environment. Passing local build and tests does not verify external providers or deploy the website.

## Deployment

Follow [deploy/README.md](deploy/README.md) for the Node production build, Docker Compose, Nginx/HTTPS and additive `prepare:production` storage setup. See [OTP and payment setup](deploy/OTP-PAYMENTS.md) for credentials, provider switches, webhook/capture settings and the final real-service checks.
