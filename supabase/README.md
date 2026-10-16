# supabase/

| Path | What it is | When to run it |
|---|---|---|
| `schema.sql` | Canonical, idempotent schema: tables, owner backfill, indexes, RLS, Storage policies, notifications, payment constraint, `create_sale` | New project, or to bring an existing project up to date |
| `migrations/001_drop_legacy_create_sale.sql` | Drops the old 4-argument `create_sale` overload (it can cause PostgREST `PGRST203` and still accepts retired payment values) | Existing project that was set up before v0.2.0 |
| `migrations/002_notifications.sql` | Creates the `notifications` table, which older copies of `schema.sql` did not include | Existing project where the notification center does not persist |
| `legacy/` | Archived earlier scripts (`schema-v5-original.sql`, `APPLY-FINAL-FIX.sql`) | Never, reference only |

Migrations are idempotent and numbered in the order they should be applied. `schema.sql` already contains everything the migrations do,
so a new project never needs them.

Run scripts in the Supabase **SQL Editor** of the same project the app is configured with (`NEXT_PUBLIC_SUPABASE_URL`).
