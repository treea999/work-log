# Vercel deployment

## Project settings

- Import the repository into Vercel and set **Root Directory** to `ppms`.
- Framework preset: Next.js.
- Node.js: 20.19 or newer.
- Do not commit `.env` or production credentials.

## Required environment variables

Configure these for Production, Preview, and Development as appropriate:

- `DATABASE_URL`: pooled PostgreSQL connection string with TLS enabled.
- `JWT_SECRET`: a cryptographically random secret of at least 32 bytes.
- `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_DEPARTMENT`: only required while provisioning the first administrator.

Use `.env.example` as the variable-name reference. Never reuse its placeholder values.

## First deployment

1. Create an empty PostgreSQL database and configure `DATABASE_URL` in Vercel.
2. Apply the committed schema from a trusted terminal or CI environment:

   ```bash
   npm ci
   npm run db:deploy
   ```

3. Provision the first administrator from the same trusted environment:

   ```bash
   npm run db:seed
   ```

4. Remove `ADMIN_PASSWORD` from Vercel after provisioning. Keep the remaining administrator variables only if your operational process needs repeatable updates.
5. Deploy the application. `postinstall` generates Prisma Client during every Vercel dependency installation.

## Release checks

Run before promoting to Production:

```bash
npm test
npm run lint
npm run typecheck
npm run build
npx prisma validate
```

The build fails intentionally when Production is missing a real `DATABASE_URL`; authentication fails closed when `JWT_SECRET` is absent.
