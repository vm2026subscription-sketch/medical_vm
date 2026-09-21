# MedPath by Vidyarthi Mitra frontend

React, TypeScript and TanStack Start website. Use npm with the committed lockfile.

Run npm ci, configure VITE_API_URL in .env for a new environment, and run npm run dev. The backend must be running at the configured API URL. Records come from that API; there is no demo login or hardcoded sample catalog.

Validation: npm run typecheck, npm run build, npm run test:e2e. Browser tests use isolated mocked responses and do not charge users or connect to production data. The build is written to .output using the Nitro target configured in vite.config.ts.

See [the project README](../README.md) for startup and [the admin guide](../ADMIN-GUIDE.md) for data entry, Excel templates and production setup.

The default Nitro target is `node-server`. After `npm run build`, use `npm start` to run `.output/server/index.mjs`. Set `PORT`, `HOST`, and optionally the server-only `INTERNAL_API_URL`; browser requests use the build-time `VITE_API_URL`. See [deployment instructions](../deploy/README.md).
