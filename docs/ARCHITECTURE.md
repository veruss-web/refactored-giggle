# Architecture

## Overview

```text
app/layout.tsx           fonts, metadata, global CSS
app/page.tsx             auth gate
   ├─ not configured  →  <ConfigError/>
   ├─ no session      →  <Login/>
   └─ session         →  <Dashboard session=…/>
                            ├─ sidebar + top bar + universal search + notification center
                            └─ one screen at a time (components/screens/*)
```

The whole UI is a client-side application (`'use client'`) that talks to Supabase directly. There are no custom API routes:
authorization is enforced by Row Level Security and by the `create_sale` database function.

## Modules

| Path | Responsibility |
|---|---|
| `app/page.tsx` | Reads the Supabase session and chooses between Login, ConfigError and Dashboard |
| `components/dashboard/dashboard.tsx` | Owns all domain state, loads data, subscribes to realtime changes, handles create/update/delete, notifications, navigation |
| `components/dashboard/global-search.tsx` | Results of the universal search in the top bar |
| `components/screens/*` | Presentational screens. They receive data and callbacks as props and hold only UI state |
| `components/shared/modal.tsx` | Product / category / customer form dialog and the delete confirmation dialog |
| `components/shared/primitives.tsx` | `Kpi`, `Head`, `TableHead`, `Actions`, `Empty`, `Field` |
| `components/shared/customer-picker.tsx` | Searchable customer selector used at checkout |
| `lib/types.ts` | Domain types shared by every module |
| `lib/customers.ts` | Pure logic: parse customer order targets, match them to completed orders (unit-tested) |
| `lib/format.ts` | `money()` (IDR) |
| `lib/navigation.ts` | Sidebar items, page titles and descriptions |
| `lib/store.ts` | Receipt store profile (`NEXT_PUBLIC_STORE_*`) |
| `lib/product-images.ts` | Product photo upload to the `product-images` bucket |
| `lib/supabase.ts` | Supabase client, `ensureFreshSession`, `runWithAuthRetry`, `friendlySupabaseError` |

## Data flow

1. `Dashboard` calls `load()` once after mount. Every query is filtered with `owner_id = <user id>`; RLS enforces the same on the server.
2. Relations are joined **on the client** (category → product, customer → order) from the freshly loaded lists.
3. Realtime subscribes to `orders` and `order_items`; other tables are refreshed by `load()` or by the local update that follows each write.
4. Writes go through `runWithAuthRetry`, which refreshes the session and retries once when an auth-looking error occurs.
5. After a **delete**, local state mirrors the database's `ON DELETE SET NULL`: deleting a category clears `category_id` on its
   products, deleting a customer clears `customer_id` on their orders, deleting a product clears `product_id` on its order items.
   Without this, stale labels would remain until the next reload.

## Checkout

`POS` calls the `create_sale` RPC with the cart. The function runs in one transaction: it locks the product rows, checks ownership,
stock and the paid amount, creates the order and its items, decrements stock, and writes stock movements. The client then
fetches the order items and shows the receipt. Valid payment methods are `cash`, `ewallet` and `atm`.

## Stock adjustments

`Inventory` updates stock with a compare-and-swap (`update … where stock = <value shown on screen>`). If another device changed the
stock in the meantime, nothing is written, the screen is refreshed with the latest value and the user is asked to repeat the
adjustment. This prevents a manual adjustment from overwriting a sale.

## Styling

`app/globals.css` is a single ordered cascade of refinements. Later rules override earlier ones on purpose, so the file must not be
reordered or split without re-checking every screen. When changing a style, edit the **last** rule that matches the selector rather
than appending another override. The v0.2.0 clean-up removed rules that could never match and declarations that were always overridden;
see the [changelog](../CHANGELOG.md) for how rendering equivalence was verified.

The stylesheet also respects `prefers-reduced-motion` and provides a keyboard focus ring for controls without their own focus style.

## Conventions

- Props are typed where a contract matters (`lib/types.ts`); screens that predate the split still accept `any` props. Tighten them when you touch them.
- Never spread form state into a database write. Build an explicit payload (see `save()` in the dashboard).
- Never use `alert()`; surface errors through the dashboard's `error` banner.
- Keep pure logic in `lib/` without React or Supabase imports so it can be unit-tested (`scripts/run-tests.mjs` compiles `lib/customers.ts` and `lib/format.ts`).

### Adding a screen

1. Create `components/screens/<name>.tsx` exporting the component.
2. Add the page key to `Page` in `lib/types.ts` and an entry in `lib/navigation.ts` (`nav`, `pageTitle`, `pageDescription`).
3. Render it in the dashboard's page switch and pass the data and callbacks it needs.

## Known limitations and next steps

- `dashboard.tsx` is still large (data loading, handlers and layout in one component). Extract hooks (`useDashboardData`, `useNotifications`) when it next changes.
- Source files keep their dense one-line style. Run `npx prettier --write "{app,components,lib}/**/*.{ts,tsx}"` once (`.prettierrc.json` is included);
  Prettier does not change behavior, but commit the result separately.
- Unused template dependencies (`components/ui`, Tailwind, Radix, Recharts, Zod, React Hook Form, …) can be removed with `npm uninstall` once nothing imports them.
- Next.js 13.5.1 predates several security advisories. Run `npm audit` and upgrade to the latest patched release of your major line.
- Spaced teen numbers in customer targets (“dua belas”) are not converted to digits; only “duabelas” is.
