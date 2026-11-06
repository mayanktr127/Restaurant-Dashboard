# MyPlanetServices Restaurant Dashboard: Implementation Plan

## 1. Goal

One web application where:
- **Restaurant owners** log in with their own account and manage **only their restaurant**.
- **Managers** run day-to-day operations with limited access.
- **Kitchen staff** use a separate **kitchen screen** (tablet) that shows only live orders.
- **Platform admin** (MyPlanetServices) manages all clients.

It connects to the existing ordering system (customer QR menu page + n8n workflows + Telegram + email).

---

## 2. Tech stack (fixed, do not change)

| Part | Choice |
|---|---|
| Framework | **Next.js (latest stable, App Router) + TypeScript (strict)** |
| Styling / UI | **Tailwind CSS + shadcn/ui**, icons: **lucide-react**, font: **Inter** |
| Charts | **Recharts** (via shadcn chart components) |
| Forms / validation | **react-hook-form + zod** |
| Database | **Supabase (Postgres)**, hosted project (no local Docker) |
| Supabase client | **@supabase/supabase-js + @supabase/ssr** (server client, browser client, middleware) |
| Login | **Supabase Auth**: magic link for owners, managers and admins |
| Multi-tenant security | **Row Level Security (RLS)** on every table + role checks in server code |
| Live updates | **Supabase Realtime** |
| Files | **Supabase Storage** (bucket `media`: logos, dish photos) |
| Server-side actions | **Next.js Server Actions and Route Handlers**. The service role key is used only here, never in the browser |
| QR codes | **qrcode** npm package, printable PDF with **pdf-lib** |
| Automations | **n8n** (existing) |
| Hosting | **Cloudflare Workers** using **@opennextjs/cloudflare** |
| Domains | `dashboard.myplanetservices.com` (owner, manager, admin) and `kitchen.myplanetservices.com` (kitchen) |

### App areas (route structure)
```
app/
  (public)/login            → magic link login
  (public)/auth/callback    → login callback
  (public)/invite/[token]   → accept invite
  app/...                   → owner + manager area
  kitchen/pair              → kitchen pairing screen
  kitchen/...               → kitchen screen
  admin/...                 → platform admin area
  api/...                   → route handlers (pairing, n8n hooks, exports)
middleware.ts               → session refresh + role-based redirects
```

---

## 3. Roles and permissions

| Area | Admin | Owner | Manager | Kitchen |
|---|---|---|---|---|
| All restaurants | yes | no | no | no |
| Live orders, change status | yes | yes | yes | yes |
| Prices and totals | yes | yes | yes | **hidden** |
| Sales reports | yes | yes | no | no |
| Mark item sold out | yes | yes | yes | only if `kitchen_can_soldout` |
| Add/edit dishes and prices | yes | yes | only if `manager_can_edit_menu` | no |
| Customers (opt-in only) | yes | yes | no | no |
| Settings | yes | yes | open/close only | no |
| Payment settings | yes | yes | no | no |
| Team and devices | yes | yes | no | no |
| Billing | yes | yes | no | no |
| Activity log | yes | yes | no | no |

**Rule:** permissions are enforced by **RLS + server-side checks**, never only by hiding buttons.

---

## 4. Login methods

- **Owner / Manager / Admin:** Supabase Auth magic link. Session refreshed in middleware. "Log out of all devices" in profile.
- **Development only:** seeded test users can log in with email + password on `/login` when `NODE_ENV=development` (hidden in production).
- **Admin:** a normal user that also has a row in `platform_admins`.
- **Kitchen device:** owner creates a **6-digit pairing code** (expires in 10 minutes). The tablet opens `/kitchen/pair` and enters the code. A server route handler creates a dedicated Supabase user for the device (role `kitchen` membership for that restaurant), signs the tablet in, and stores the device in `kitchen_devices`. The owner can revoke a device; revoking deletes the device user and its sessions.
- **Kitchen staff PIN (optional):** 4-digit PIN per cook, chosen on the kitchen screen at shift start, used to record who started or finished an order. PINs are stored hashed (bcrypt).

---

## 5. Database design

All business tables have `restaurant_id uuid not null`. Money is in **cents** (integer). Timestamps are `timestamptz`.

| Table | Columns |
|---|---|
| `restaurants` | id, slug (unique), name, logo_url, brand_color, address, phone, website, timezone (default `America/Chicago`), status (`setting_up`/`trial`/`active`/`paused`/`cancelled`), plan_name, tax_rate (numeric), prep_minutes, is_open, pay_mode (`counter`/`stripe`), table_contact (`none`/`optional`), pickup_contact (`email`/`phone`/`email_or_phone`), min_order_cents, telegram_chat_id, telegram_enabled, customer_email_sender_name, customer_email_reply_to, ready_message, kitchen_can_soldout, manager_can_edit_menu, onboarding (jsonb), created_at |
| `platform_admins` | user_id (pk) |
| `memberships` | id, user_id, restaurant_id, role (`owner`/`manager`/`kitchen`), display_name, email, active, created_at. Unique (user_id, restaurant_id) |
| `staff_pins` | id, restaurant_id, display_name, pin_hash, active, created_at |
| `kitchen_devices` | id, restaurant_id, user_id, name, last_seen_at, revoked_at, created_at |
| `pairing_codes` | id, restaurant_id, code_hash, expires_at, used_at, created_by |
| `invites` | id, restaurant_id, email, role, token_hash, expires_at, accepted_at, created_by |
| `categories` | id, restaurant_id, name, sort_order, visible |
| `menu_items` | id, restaurant_id, category_id, name, description, price_cents, photo_url, available, visible, sort_order, tags (text[]) |
| `tables` | id, restaurant_id, label, active, sort_order |
| `orders` | id, restaurant_id, order_number (unique per restaurant), order_type (`table`/`pickup`), table_label, customer_name, customer_email, customer_phone, notes, subtotal_cents, tax_cents, total_cents, payment_mode, payment_status (`unpaid`/`pending`/`paid`/`refunded`), provider_ref, status (`pending_payment`/`new`/`cooking`/`ready`/`collected`/`problem`/`cancelled`), problem_reason, is_test, created_at, started_at, ready_at, collected_at, started_by, ready_by |
| `order_items` | id, order_id, restaurant_id, menu_item_id, name, unit_price_cents, qty, notes |
| `kitchen_tickets` | order_id (pk), restaurant_id, order_number, order_type, table_label, customer_first_name, notes, items (jsonb: name, qty, notes), status, problem_reason, created_at, started_at, ready_at. **Filled by trigger from `orders` + `order_items`. No prices, no contacts** |
| `customers` | id, restaurant_id, name, email, phone, marketing_consent, orders_count, total_spent_cents, first_order_at, last_order_at |
| `opening_hours` | id, restaurant_id, weekday (0–6), opens_at (time), closes_at (time) |
| `closures` | id, restaurant_id, date, reason |
| `activity_log` | id, restaurant_id, actor_type (`admin`/`owner`/`manager`/`kitchen`/`system`), actor_name, action, details (jsonb), created_at |
| `billing` | restaurant_id (pk), plan_name, amount_cents, next_due_date, status (`paid`/`due`/`overdue`/`paused`) |
| `announcements` | id, message, active, created_at |

### Database functions
- `is_platform_admin()`: boolean
- `has_role(rid uuid, roles text[])`: boolean (active membership)
- `set_order_status(order_id uuid, new_status text, reason text, staff_name text)`: **security definer**. Checks the caller's role for that restaurant, updates `orders` timestamps, writes `activity_log`
- `get_public_menu(slug text)`: **security definer**. Returns restaurant name, logo, colour, is_open, prep_minutes, tax_rate, pay_mode, contact rules, and visible categories with visible items. Only for `trial`/`active` restaurants
- Trigger: keep `kitchen_tickets` in sync with `orders` / `order_items`
- Trigger: update `customers` stats when an order becomes `new` and the customer gave an email or phone with consent
- View `daily_stats`: per restaurant per day: orders_count, sales_cents, avg_order_cents (`security_invoker = true`)

### RLS rules
- **Admin:** all rows.
- **Owner:** all rows of own restaurant.
- **Manager:** read orders, order_items, menu, tables, restaurants (own). Update `menu_items.available`; update menu fields only if `manager_can_edit_menu`; update `restaurants.is_open` only.
- **Kitchen:** read `kitchen_tickets` of own restaurant only. Update `menu_items.available` only if `kitchen_can_soldout`. Status changes only through `set_order_status`.
- **Anonymous:** nothing directly; uses `get_public_menu`.
- **n8n:** uses the service role key (server-side only).

Realtime publication: `orders` (owner/manager) and `kitchen_tickets` (kitchen).

---

## 6. Pages

### Owner / manager area (`/app`)
1. **Home**: today's orders, sales, average order, waiting now, open/close switch, alerts (sold-out count, offline kitchen device, orders waiting > 20 min), setup checklist
2. **Orders**: live board New → Cooking → Ready → Collected, timers (green < 10 min, orange 10–20, red > 20), new-order sound, Problem with reason
3. **Order history**: search, filters (date, status, payment, type), order timeline, CSV export
4. **Menu**: categories (add, rename, reorder, hide), dishes (photo upload, price, description, tags, sold-out switch, show/hide, reorder), customer preview
5. **Tables & QR**: add/rename/remove tables, download QR PDF (table tents, stickers, single sheet), pickup QR
6. **Reports**: sales by day/week/month vs previous period, best and worst sellers, busy-hours heat map, table report, kitchen speed (avg new → ready), payment split
7. **Customers**: opt-in list, CSV export
8. **Settings**: profile (name, logo, colour, address, phone, website), opening hours + closures, ordering rules (table/pickup contact rules, prep time, min order), payments, tax, notifications (Telegram on/off), customer email (sender name, reply-to, ready message)
9. **Team**: people (invite manager by email, change role, remove), kitchen devices (pair, rename, revoke, last seen), staff PINs (add, reset, remove), permission switches
10. **Billing**: plan, amount, next due date, status
11. **Activity log**: filterable list
12. **Help**: short guides + "Request help" form (sends to admin)

### Kitchen area (`/kitchen`)
- Pairing screen (6-digit code)
- Board: New | Cooking | Ready, dark theme, large cards (table or "Pickup – first name", items, notes in red, timer colour), new-order sound + flash
- Buttons: Start, Ready, Problem (reasons: out of stock, kitchen issue, other), Undo (last 10 actions)
- Optional sold-out panel (only if allowed)
- Optional staff PIN picker at shift start
- Online/offline indicator, keep-awake (Wake Lock API)
- No prices, totals, contacts, settings or links to other areas

### Admin area (`/admin`)
- Clients list (status, plan, joined, orders today, last order, device online)
- Add client (creates restaurant + default tables 1–10 + owner invite)
- Client detail: onboarding progress, settings, billing status, pause/activate
- View as owner (read-only, logged in activity_log)
- Error log (from n8n)
- Announcements

---

## 7. Onboarding flows

**New client**
1. Admin → Add client (restaurant name, owner name, owner email, plan) → restaurant created (status `setting_up`) → invite email sent.
2. Owner accepts the invite (magic link) → setup checklist on Home: Profile → Menu → Tables & QR → Payments → Kitchen device or Telegram → Team (optional) → Test order → Go live.
3. Go live sets status `active` and writes an activity log entry visible to admin.

**Kitchen device:** Team → Kitchen devices → Add → 6-digit code → tablet opens `/kitchen/pair` → enters code → paired.
**Cooks (optional):** Team → Staff PINs → Add name → system shows a 4-digit PIN once.
**Manager:** Team → Invite → email + role Manager → invite email → magic link.
**Removal:** remove person, PIN or device → access ends immediately.

---

## 8. Connection to the existing ordering system

| Today | After |
|---|---|
| Menu page reads the menu via n8n from Google Sheets | Menu page calls `get_public_menu(slug)` in Supabase (anon key) |
| n8n Checkout writes orders to Sheets | n8n Checkout reads prices from Supabase (service role) and inserts `orders` + `order_items` |
| n8n Payment confirmed updates Sheets | Updates `orders.payment_status` and `status` in Supabase |
| Telegram buttons in kitchen | Kitchen screen is primary. Telegram stays as an optional backup (`telegram_enabled`) |
| Ready email sent from the Telegram workflow | Supabase Database Webhook on `orders` status → `ready` calls the n8n webhook → n8n sends the email |
| Workflow 5 form adds restaurants | Admin "Add client" page |
| n8n error alerts | Also POST to `/api/n8n/error` (shared secret header) → stored for the admin error log |

---

## 9. Build phases

| Phase | Work | Done when |
|---|---|---|
| **0. Setup** | Next.js project, Tailwind, shadcn/ui, Supabase clients, env files, folder structure, Cloudflare deploy config, base layouts | App runs locally and deploys a placeholder page |
| **1. Database** | Migrations: tables, functions, triggers, RLS, realtime, storage bucket; seed script; isolation test script | Isolation test passes |
| **2. Auth & roles** | Magic link, dev password login, callback, middleware guards, invites, kitchen pairing, staff PINs, role-based redirects | Each role lands in its own area and cannot open others |
| **3. Owner area v1** | Layout, Home, Orders (live), Menu, Tables & QR, Settings (profile, ordering, payments, notifications), Team (devices, invite manager) | Owner can run a full day |
| **4. Kitchen screen** | Board, realtime, sound, actions, undo, sold-out panel, PIN picker, offline indicator | New order appears within 2 seconds |
| **5. Admin v1** | Clients list, Add client, client detail, pause/activate, view as owner | Admin can onboard a client end to end |
| **6. n8n integration** | `get_public_menu`, menu page update, n8n checkout/payment to Supabase, ready-email webhook, error log endpoint | Real QR order flows through the kitchen screen and the owner area |
| **7. Version 2** | Order history + CSV, Reports, Customers, Opening hours + closures, Activity log, Manager permissions, Staff PIN management, Setup checklist + test order, Billing, Help, Announcements | All pages in section 6 work |
| **8. Hardening** | Security tests, loading/empty/error states, mobile layouts, accessibility, performance | Checklist in section 10 passes |
| **9. Launch** | Custom domains, custom SMTP for auth emails, production env, backups, monitoring | First real client live |

---

## 10. Testing checklist

- Owner A cannot read or change anything of Restaurant B (UI, URL edits, direct Supabase queries with A's session).
- Manager cannot open reports, customers, team, billing, payments or activity log.
- Kitchen cannot open `/app` or `/admin`, and cannot read `orders`, `order_items` or `customers`.
- Revoked device, removed member and removed PIN lose access immediately.
- Expired pairing codes and invites fail.
- Order flow: QR → order → kitchen screen → Ready → customer email.
- Sold-out item disappears from the customer menu.
- Closed restaurant blocks new orders.
- Reports match order data.
- Works on phone (owner) and tablet (kitchen).

---

## 11. Rules for the AI agent

See `.agents/rules/project-rules.md`.
