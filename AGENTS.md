# Work Log - Agent Guide

This file describes the current implementation. Keep it updated whenever architecture, authentication, navigation, deployment, or user-visible behavior changes.

## Stack

- Framework: Next.js 16.2.10 App Router with React 19.2.4
- Database: PostgreSQL through Prisma 7.9.0 and `@prisma/adapter-pg`
- Validation: Zod schemas shared by frontend and server
- Styling: Tailwind CSS v4 with semantic CSS variables
- Authentication: bcrypt passwords, signed JWT, and the `ppm_token` HttpOnly cookie
- Authorization: role and permission checks in `src/proxy.ts` plus resource-level service checks
- UI: Lucide React, Recharts, and react-hot-toast
- Export: xlsx, jsPDF, html2canvas
- Tests: Node test runner and tsx tests

## Required Safety Rules

- Never restore an anonymous or production Admin fallback.
- `JWT_SECRET` must be configured and contain at least 32 bytes.
- Production must have a real PostgreSQL `DATABASE_URL`; production must fail fast when it is absent or a placeholder.
- `AUTH_BYPASS_ENABLED` is development-only. The auth route must reject bypass whenever `NODE_ENV === "production"`.
- Never expose database seeding through a public API. Use `npm run db:seed` from a trusted environment.
- Mutating Timesheet and Budget operations must pass through their service layer and write an AuditLog event.
- Preserve `.env`, TypeScript, and ESLint configuration unless the user explicitly requests a change.
- Do not delete `AGENTS.md`, `CLAUDE.md`, or `design.md`.

## Current Application Structure

```text
src/
|-- app/
|   |-- layout.tsx                 # Root metadata, fonts, and global body
|   |-- page.tsx                   # Root redirect
|   |-- login/page.tsx             # Branded login and optional development bypass
|   |-- (workspace)/
|   |   |-- layout.tsx             # Persistent sidebar, topbar, user menu, logout
|   |   |-- dashboard/page.tsx
|   |   |-- projects/
|   |   |-- mywork/page.tsx
|   |   |-- approvals/page.tsx
|   |   |-- reports/page.tsx
|   |   `-- settings/page.tsx
|   `-- api/
|       |-- auth/route.ts
|       |-- timesheets/
|       |-- budgets/
|       `-- legacy portfolio routes
|-- contracts/                     # Shared Zod schemas and inferred types
|-- lib/
|   |-- auth-server.ts             # Password hashing and JWT helpers
|   |-- auth.ts                    # Legacy roles and permission map
|   `-- prisma.ts                  # Prisma client; development-only mock fallback
|-- server/
|   |-- auth/authorization.ts
|   |-- audit/audit.repository.ts
|   |-- http/route.ts
|   `-- modules/
|       |-- auth/
|       |-- timesheet/
|       `-- budget/
`-- proxy.ts                       # Next.js 16 authentication and coarse RBAC gate
```

Each enterprise module under `src/server/modules/{auth,timesheet,budget}/` owns its `.service.ts`, `.repository.ts`, `.schema.ts`, and `.types.ts` files. Timesheet and Budget API handlers must remain thin HTTP layers: parse request, validate input, call a service, and return a response.

## Authentication and Development Bypass

- Normal login uses `POST /api/auth` with `{ action: "login", name, password }`.
- Logout uses `{ action: "logout" }`, expires `ppm_token`, and redirects to `/login`.
- Local development bypass is enabled by `AUTH_BYPASS_ENABLED="true"` in `.env.local`.
- The login page requests `{ action: "bypass" }` automatically. The server issues a signed development Admin session only outside production.
- Logout sets the short-lived `ppm_skip_bypass` cookie for 60 seconds so the login page does not immediately bypass back into the workspace.
- `.env.example` keeps `AUTH_BYPASS_ENABLED="false"` as the safe default.
- Do not commit `.env.local`; it is covered by `.env*` in `.gitignore`.

## Roles and Workflows

Legacy database roles map to enterprise actor roles:

| Database role | Actor role |
|---|---|
| Member | employee |
| PM / Approver | manager |
| Auditor | hr |
| Finance | finance |
| Admin | admin |

Timesheet workflow:

```text
draft -> submitted -> approved -> locked
                   `-> rejected
```

Budget workflow:

```text
draft -> pending_review -> approved -> active
                       `-> rejected
```

## Prisma Models

The schema currently contains 12 models:

- User
- Project
- ProjectMember
- Expense
- WorkItem
- Risk
- Approval
- AuditLog
- Notification
- Timesheet
- TimesheetEntry
- Budget

The baseline migration is `prisma/migrations/20260722120000_init/migration.sql`. Run migrations with `npm run db:deploy`; provision the first administrator with `npm run db:seed`.

## Workspace Navigation and Layout

- All authenticated pages use the single persistent `(workspace)/layout.tsx` shell.
- Sidebar navigation uses Next.js `Link`; switching menu items must not slide or remount the shell.
- Sidebar items: Dashboard, Projects, My Work, Approvals, Reports, Settings.
- The sidebar must not render a user card or bottom bar.
- User identity is shown only in the top-right avatar menu.
- The top-right user menu contains the user name, role, optional development user list, and Logout button.
- Main content scrolls independently; the sidebar and topbar stay inside the viewport.

## Login Branding

- Logo asset: `public/tird-logo.png`
- The logo is rendered above “Work Log” with `next/image` and preserved dimensions.
- `mix-blend-multiply` blends the logo's white background into `--canvas-soft`.
- The Work Log wordmark uses Archivo ExtraBold to match the geometric corporate logo.

## Design Tokens

- `--primary: #171717`
- `--canvas: #ffffff`
- `--canvas-soft: #fafafa`
- `--canvas-soft-2: #f2f2f2`
- `--hairline: #ebebeb`
- `--ink: #171717`
- `--body: #555555`
- `--mute: #888888`
- `--link: #2563eb`
- `--success: #16a34a`
- `--warning: #d97706`
- `--error: #dc2626`

Use semantic tokens rather than adding raw colors, except for explicit semantic actions such as the red Logout treatment.

## Deployment

- Vercel Root Directory must be `ppms`.
- Required production variables: `DATABASE_URL` and `JWT_SECRET`.
- Keep `AUTH_BYPASS_ENABLED` unset or `false` in Vercel.
- `postinstall` runs `prisma generate`.
- Follow `DEPLOYMENT.md` for migrations and first-admin provisioning.

## Verification Commands

```bash
npm test
npm run typecheck
npm run lint
npm run build
npx prisma validate
npm audit --omit=dev
```

Focused regression tests exist for persistent navigation, no sidebar user card, user-menu logout, development bypass, production auth security, Timesheet services, and Budget services.

## Implemented Change Log

### Enterprise refactor

- Added Service + Repository modules for Auth, Timesheet, and Budget.
- Added shared Zod contracts, thin Timesheet/Budget routes, RBAC, AuditLog persistence, and approval workflows.
- Added unit tests under `tests/unit/` and integration tests under `tests/integration/`.

### Vercel readiness and security

- Replaced deprecated `middleware.ts` with Next.js 16 `src/proxy.ts`.
- Removed fallback JWT secrets and anonymous Admin access.
- Added secure login/logout cookies, production database fail-fast, Prisma postinstall generation, baseline migration, secure CLI seeding, `.env.example`, and `DEPLOYMENT.md`.
- Fixed the Zod Budget schema build failure caused by calling `.partial()` after a refinement.

### Shared application shell

- Moved authenticated pages into the `(workspace)` route group so one sidebar/topbar persists across navigation.
- Removed sliding navigation behavior and fixed sidebar viewport overflow.
- Removed the duplicate Development Admin card from the bottom of the sidebar.
- Added Logout to the top-right user dropdown with loading and disabled states.

### Login page

- Added the TIRD logo above Work Log.
- Enlarged the logo and blended its background into the page canvas.
- Changed the Work Log wordmark to Archivo ExtraBold.
- Added opt-in development bypass via `.env.local`, with a production deny rule and post-logout bypass suppression.
