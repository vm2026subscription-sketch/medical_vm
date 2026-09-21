# MedPath by Vidyarthi Mitra API

Express, MongoDB and Redis backend. Use the Node version specified in package.json and npm with the committed lockfile.

## Startup

Run npm ci. For a new environment only, copy .env.example to .env and configure services. Start the API with npm run dev locally or npm start in production. Start npm run worker separately for subscription expiry, notifications and temporary slot release.

## Accounts and data

The database is not automatically populated. Sign up through the website, then run:

    npm run make-admin -- <email-or-phone>
    npm run prepare:imports

The first command creates the admin role and promotes an existing user. The second prepares additive import storage and indexes in the configured database. Publishing requires MongoDB Atlas or another replica set because it uses transactions.

Use Admin > Data entry for courses, colleges, college-course links, fees, cutoffs and seats. Check a private entry and send it for approval. The main admin uses Review & publish; Entry history tracks saved and published work. Old direct catalog-write endpoints are retired. Manage plans, coupons, counsellors, services and other operational data through their admin tabs.

Download Excel formats in the import panel or use ../samples/imports. Replace sample values with verified data. No demo seeder or demo login endpoint is included.

## Checks

    npm test
    npm run test:integration
    npm run lint
    npm run check:services

Unit tests use Jest. Integration tests create their own temporary MongoDB replica set, never the configured application database. Their first run can download a runtime to .cache/mongodb; this remains a development dependency.

check:services makes read-only provider checks. It does not verify actual OTP delivery, payment capture, webhook fulfillment or deployment.

## Deployment notes

- Configure SMTP for email OTP and the selected SMS provider for phone OTP. Mock delivery is only a development option; production blocks it.
- Set distinct JWT secrets, HTTPS origins, the public frontend API URL and Razorpay API/webhook credentials.
- Keep the raw-body Razorpay webhook route before the JSON parser in src/app.js.
- Captured payments and entitlement activation now use a MongoDB transaction. Isolated tests cover concurrent delivery, rollback and retry. Complete the real-provider acceptance checks in [OTP-PAYMENTS.md](../deploy/OTP-PAYMENTS.md) before launch.
- Upload college images through the reviewed Cloudinary workflow. Assign actual meeting URLs through the admin panel.
- The root `compose.yaml` runs the API, worker, frontend and private Redis. Supply Atlas or a replica set through `MONGODB_URI`; no standalone MongoDB is bundled. See [deployment instructions](../deploy/README.md).

See [ADMIN-GUIDE.md](../ADMIN-GUIDE.md) for permissions, spreadsheet relationships and the production handoff.
