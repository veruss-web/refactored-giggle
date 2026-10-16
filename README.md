# MIEFLOW POS (Mie-kelar)

Point-of-sale and store-management dashboard for noodle shops, cafés and other small businesses.
Built with **Next.js (App Router), React, TypeScript and Supabase**.

> Private project · version 0.2.0 · see the [changelog](CHANGELOG.md).

## Features

- Cashier (Kasir): searchable catalog, cart, customer picker, cash / e-wallet / ATM payment, thermal receipt (58 mm / 80 mm)
- Products, categories and customers (create, edit, delete), product photos in Supabase Storage
- Inventory with conflict-safe stock adjustments (an adjustment never overwrites a sale made on another device)
- Transaction history with filters, sorting, pagination and order detail
- Analytics: revenue trend, top products, category breakdown, custom periods
- Customer order targets and fulfilment tracking
- Notification center (persisted per user), universal search, responsive layout for phone, tablet and desktop
- Multi-user: every record has an `owner_id`; Row Level Security keeps each account's data private

## Technology

| Layer | What the code actually uses |
|---|---|
| Framework | Next.js 13.5 (App Router), React 18 |
| Language | TypeScript (strict) |
| Backend | Supabase: Auth, PostgreSQL with RLS, Storage, Realtime |
| Styling | Hand-written CSS in `app/globals.css` (no CSS framework is loaded) |
| Animation / icons | Framer Motion, Lucide |
| Charts | Inline SVG (no chart library) |
| Tests | Node's built-in test runner (no extra packages) |
| CI | GitHub Actions (`.github/workflows/ci.yml`) |

`components/ui/` (shadcn/Radix), Tailwind, Recharts, Zod and React Hook Form are installed but **not used** by the app;
they are leftovers from the project template and can be pruned later (see [Architecture](docs/ARCHITECTURE.md#known-limitations-and-next-steps)).

## Quick start

1. Install Node.js 20 or 22 and create a [Supabase](https://supabase.com) project.
2. In the Supabase **SQL Editor** run [`supabase/schema.sql`](supabase/schema.sql). It is idempotent and also safe on an existing project.
3. Copy the environment template and fill in the values of the **same** Supabase project:
   ```bash
   cp .env.local.example .env.local
   ```
4. Install and run:
   ```bash
   npm install
   npm run dev      # http://localhost:3000
   ```
5. Create an account on the login screen. The first screen is empty until you add products.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `next lint` |
| `npm test` | Unit tests for the pure business logic in `lib/` |
| `npm run verify` | Typecheck, lint, tests and build in one go |

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Project URL of your Supabase project |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Publishable (anon) key of the same project |
| `NEXT_PUBLIC_STORE_NAME`, `_ADDRESS`, `_PHONE`, `_FOOTER` | no | Store profile printed on receipts |
| `NEXT_PUBLIC_SITE_URL` | no | Public URL, used for page metadata |
| `STRICT_BUILD` | no | `1` makes `next build` fail on TypeScript errors (CI sets it) |

Never commit real credentials. `.env.local` is git-ignored.

## Quality gates

- `npm run verify` is the release gate; CI runs the same checks on Node 20 and 22.
- By default a Vercel deploy is **not** blocked by type errors (`STRICT_BUILD` unset). Once `npm run verify` is green,
  set `STRICT_BUILD=1` in the hosting environment so deploys are gated like CI.
- Business logic that is pure (customer targets, fulfilment, formatting) lives in `lib/` and is unit-tested.

## Project structure

```text
app/                    Next.js entry: layout, auth gate (page.tsx), global CSS, icons
components/
  auth/                 Login / sign-up and the missing-configuration notice
  dashboard/            Application shell (data loading, realtime, CRUD, notifications) and universal search
  screens/              One file per sidebar page: overview, pos, orders, analytics, products, categories, customers, inventory
  shared/               Modals, small primitives, customer picker
  ui/                   Unused shadcn/ui kit (template leftover)
lib/                    Types, formatting, customer logic, navigation, store profile, Supabase client and helpers
supabase/               schema.sql (canonical), migrations/ (for existing databases), legacy/ (archived scripts)
tests/                  Unit tests (node --test)
scripts/                Test runner
docs/                   Architecture, database, deployment, operations, troubleshooting (+ archive/)
public/                 Web manifest and app icons
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md): modules, data flow, conventions
- [Database & Supabase](docs/DATABASE.md) and [supabase/README.md](supabase/README.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Operations & release checklist](docs/OPERATIONS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- `docs/archive/`: historical fix notes (not instructions for the current release)
