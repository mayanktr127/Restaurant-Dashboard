# Antigravity prompts: Restaurant Dashboard

**How to use**
1. Put this folder (`IMPLEMENTATION_PLAN.md`, `PROMPTS.md`, `.agents/rules/project-rules.md`) in an empty project folder and open it in Antigravity.
2. Copy **one prompt at a time** into the Antigravity agent chat.
3. Review the plan it shows you, approve it, let it build, then **test the phase** before moving on.
4. Do the "Manual steps" it reports (creating accounts, pasting keys).

---

## PROMPT 0: Project setup

```
Read IMPLEMENTATION_PLAN.md and .agents/rules/project-rules.md first. Follow them strictly.

Do PHASE 0 (project setup) only. Do not build any feature pages.

1. Create a Next.js project in the current folder (latest stable, App Router, TypeScript strict, ESLint, Tailwind CSS, src directory: NO, import alias "@/*"). Use npm.
2. Install and initialise shadcn/ui (style: new-york, base colour: neutral, CSS variables: yes). Add these components: button, card, input, label, textarea, select, switch, checkbox, badge, dialog, sheet, dropdown-menu, tabs, table, toast (sonner), skeleton, separator, avatar, tooltip, form, alert, scroll-area, popover, calendar, chart.
3. Install: @supabase/supabase-js, @supabase/ssr, zod, react-hook-form, @hookform/resolvers, lucide-react, date-fns, qrcode, pdf-lib, bcryptjs, @opennextjs/cloudflare (and wrangler as dev dependency). Install types where needed.
4. Font: Inter via next/font/google, applied to the whole app.
5. Design tokens in the Tailwind/shadcn theme:
   - Primary: deep green #166534 (buttons, active items). Background white, muted greys.
   - Status colours used everywhere: new = blue (#2563EB), cooking = amber (#D97706), ready = green (#16A34A), late/problem = red (#DC2626), collected = grey.
   - Rounded corners: rounded-xl on cards, rounded-lg on inputs and buttons.
   - Support dark mode with the "class" strategy (the kitchen area will always use dark).
6. Supabase helpers in lib/supabase/:
   - client.ts: browser client (createBrowserClient) using NEXT_PUBLIC_ keys only.
   - server.ts: server client (createServerClient) using Next cookies.
   - admin.ts: service-role client, with "server-only" import so it can never be used in client code.
   - middleware helper that refreshes the session.
7. middleware.ts at the root: refresh the Supabase session on every request (no role logic yet).
8. Create the folder structure from section 2 of the plan with placeholder pages that only show the page title:
   app/(public)/login, app/(public)/auth/callback (route handler placeholder), app/(public)/invite/[token],
   app/app (Home placeholder), app/kitchen (placeholder), app/kitchen/pair, app/admin (placeholder).
9. Create lib/money.ts (formatCents → "$12.50", toCents) and lib/utils.ts (shadcn cn helper).
10. Environment files:
   - .env.local.example with NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_KITCHEN_URL, N8N_SHARED_SECRET, N8N_READY_WEBHOOK_URL.
   - Make sure .env.local is in .gitignore.
11. Cloudflare: configure @opennextjs/cloudflare (open-next.config.ts, wrangler config with nodejs_compat), and add npm scripts: "preview" and "deploy" as recommended by @opennextjs/cloudflare.
12. Create supabase/migrations/ and scripts/ folders (empty, with a .gitkeep).
13. Write a short README.md: how to install, set env vars, run locally, deploy.

Do not create database tables, login logic or any feature in this phase.

At the end, report: files created, commands to run, manual steps for me (create a Supabase project, copy the URL/anon key/service role key into .env.local, create a GitHub repo), and how to check the phase works (npm run dev shows the placeholder pages; npm run build passes).
```

---

## PROMPT 1: Database

```
Read IMPLEMENTATION_PLAN.md (sections 3, 5) and .agents/rules/project-rules.md. Follow them strictly.

Do PHASE 1 (database) only. No UI work.

Use the Supabase CLI linked to my hosted project (no local Docker). If the CLI is not installed or linked, tell me the exact commands to run.

1. Migration 1 (tables): create every table in section 5 exactly with the listed columns, sensible types, defaults (uuid default gen_random_uuid(), created_at default now()), foreign keys with ON DELETE CASCADE from restaurant_id, unique constraints (restaurants.slug, memberships(user_id, restaurant_id), orders(restaurant_id, order_number)), check constraints for every enum-like text column, and indexes on restaurant_id and on orders(restaurant_id, status, created_at).
2. Migration 2 (functions and triggers):
   - is_platform_admin(), has_role(rid, roles[]) as STABLE SECURITY DEFINER with search_path set.
   - set_order_status(order_id, new_status, reason, staff_name): security definer; allowed for admin, owner, manager, kitchen of that restaurant; allowed transitions: new→cooking, cooking→ready, new→ready, ready→collected, any→problem, problem→new, and "undo" to the previous status within 10 minutes; sets started_at / ready_at / collected_at and started_by / ready_by; writes activity_log.
   - get_public_menu(slug): security definer, returns one JSON object (restaurant public fields + visible categories with visible items sorted). Only for restaurants with status trial or active. Never returns contacts, telegram ids or internal settings.
   - Trigger to insert/update kitchen_tickets whenever orders or order_items change (items as jsonb [{name, qty, notes}], customer_first_name = first word of customer_name). Only orders whose status is not pending_payment appear.
   - Trigger to upsert customers when an order becomes 'new' and has an email or phone.
   - Function to generate order_number per restaurant (short readable, e.g. "A1B2C").
   - View daily_stats with security_invoker = true.
3. Migration 3 (RLS): enable RLS on every table and create policies exactly as in section 5 "RLS rules". Kitchen must NOT be able to select orders, order_items or customers. Anonymous has no direct table access.
4. Migration 4 (realtime + storage): add orders and kitchen_tickets to the supabase_realtime publication. Create storage bucket "media" (public read) with policies: upload/update/delete only by owner/admin of the restaurant, path format {restaurant_id}/....
5. scripts/seed.ts (run with npx tsx, uses the service role key from .env.local):
   - Users (email + password, for development): admin@demo.test, owner.a@demo.test, manager.a@demo.test, owner.b@demo.test. Password for all: DemoPass123!
   - admin@demo.test in platform_admins.
   - Restaurant A "Lone Star Tacos" (slug lone-star-tacos, status active) and Restaurant B "Austin Noodle Bar" (slug austin-noodle-bar, status active).
   - Memberships: owner.a → A owner, manager.a → A manager, owner.b → B owner.
   - Each restaurant: 3 categories, 8 menu items, tables 1–10, 6 orders in different statuses with order_items, billing row.
   - Script must be safe to re-run (delete demo data first).
6. scripts/test-isolation.ts (npx tsx): signs in as each seeded user with the ANON key and checks, printing PASS/FAIL for each:
   - owner.a can read A's orders; cannot read B's orders, menu edits, customers, memberships.
   - owner.a cannot update B's menu_items or insert orders for B.
   - manager.a cannot read customers or billing; can toggle menu_items.available for A.
   - owner.b cannot read anything of A.
   - anonymous cannot select any table; get_public_menu('lone-star-tacos') works and contains no private fields.
   - admin can read both restaurants.
   Exit with code 1 if any test fails.
7. Add npm scripts: "db:seed", "db:test".

At the end, report: migration files, commands to apply them (supabase db push), how to run seed and test, and the full test output. Do not continue until all tests PASS.
```

---

## PROMPT 2: Login and roles

```
Read IMPLEMENTATION_PLAN.md (sections 2, 3, 4, 7) and .agents/rules/project-rules.md. Follow them strictly.

Do PHASE 2 (auth and roles) only.

1. /login page: email field → "Send login link" (Supabase signInWithOtp, emailRedirectTo = NEXT_PUBLIC_SITE_URL/auth/callback). Clear success message ("Check your email"). When NODE_ENV=development ONLY, also show an email + password form for seeded test users.
2. /auth/callback route handler: exchange the code for a session, then redirect by role.
3. lib/auth.ts server helpers: getSessionUser(), getUserContext() returning { user, isAdmin, memberships[] }, requireRole(restaurantId, roles[]) that throws/redirects if not allowed. Every later server action must use these.
4. Role redirect rules (in middleware + layouts):
   - Not logged in: /app, /admin, /kitchen → /login (kitchen → /kitchen/pair).
   - Admin → /admin (admin can also open /app when "viewing as owner" in phase 5).
   - Owner or manager → /app. If a user belongs to several restaurants, show a restaurant picker and store the selected restaurant id in a cookie; always re-check membership server-side.
   - Kitchen device user → /kitchen only. Any attempt to open /app or /admin → /kitchen.
   - Manager trying to open owner-only pages (reports, customers, team, billing, settings/payments, activity) → /app with a "No access" toast.
5. Invites:
   - Server action createInvite(restaurantId, email, role) (owner or admin only): stores hashed token, expires in 7 days, sends the invite via Supabase admin inviteUserByEmail or a magic link to /invite/[token].
   - /invite/[token]: validates token, signs the user in (magic link), creates the membership, marks the invite accepted, redirects to /app.
6. Kitchen pairing:
   - Server action createPairingCode(restaurantId) (owner/admin): 6 random digits, stored hashed, expires in 10 minutes, returns the code once.
   - /kitchen/pair page: big 6-digit input (dark theme, large touch targets).
   - Route handler POST /api/kitchen/pair: validates the code (not expired, not used, rate limit 5 tries per minute per IP), creates a device user with the service role (email device-{uuid}@devices.invalid, random password), membership role kitchen, kitchen_devices row, marks the code used, signs the browser in, redirects to /kitchen.
   - Server action revokeDevice(deviceId): sets revoked_at, deletes the device user (ends its sessions).
7. Staff PINs (backend only in this phase): server actions addStaffPin(restaurantId, name) → returns a random 4-digit PIN once, stored with bcrypt; verifyStaffPin(restaurantId, pin) → returns the staff name; removeStaffPin.
8. Profile menu (top right placeholder in /app): user email, "Log out", "Log out of all devices" (signOut scope global).
9. Write every security-relevant action to activity_log (invite created/accepted, device paired/revoked, PIN added/removed).

Do not build dashboard pages yet; keep the placeholder pages but protected.

At the end, report files, manual steps (Supabase Auth settings: Site URL, redirect URLs for localhost and production), and a test list: log in as each seeded user and confirm where they land; pair a device using a code created from a temporary test button or script; confirm a kitchen device cannot open /app or /admin; confirm expired codes fail.
```

---

## PROMPT 3: Owner area v1

```
Read IMPLEMENTATION_PLAN.md (sections 3, 6, 7) and .agents/rules/project-rules.md. Follow them strictly.

Do PHASE 3 (owner/manager area v1) only. Build exactly these pages; other menu items appear in the sidebar but show "Coming soon" (they are built in phase 7).

Design rules:
- Clean, calm, professional (like Shopify admin). White background, cards with rounded-xl and subtle border, lots of white space, Inter font, primary green #166534, status colours from phase 0.
- Desktop: left sidebar (Home, Orders, Order history, Menu, Tables & QR, Reports, Customers, Team, Settings, Billing, Activity, Help) with lucide icons; top bar with restaurant logo + name, a large Open/Closed switch, restaurant picker (if several), profile menu.
- Phone (< 768px): bottom tab bar (Home, Orders, Menu, More); "More" opens a sheet with the remaining pages.
- Hide sidebar items the current role cannot access (and still enforce on the server).
- Every list has loading skeletons, empty states with a helpful message, and error alerts.

Pages:
1. Home (/app): 4 stat cards (Orders today, Sales today, Average order, Waiting now) based on the restaurant timezone; live mini-list of the 5 newest active orders; alerts card (sold-out items count, kitchen devices offline > 5 min, orders waiting > 20 min); Open/Closed switch (owner + manager).
2. Orders (/app/orders): live board with columns New, Cooking, Ready, Collected (Collected shows today only). Cards: order number, "Table X" or "Pickup – name", items, notes, total, time since ordered with colour (green < 10, orange 10–20, red > 20 min). Actions via set_order_status: Start, Ready, Collected, Problem (dialog with reason), Undo. Supabase Realtime subscription on orders for this restaurant; play a short sound and show a toast for new orders (with a "Sound on/off" toggle stored in localStorage).
3. Menu (/app/menu): categories as sections (add, rename, hide, drag to reorder); items with photo thumbnail, name, price, sold-out switch, visible switch; "Add item"/"Edit item" in a side sheet (name, description, price in dollars, category, photo upload to Supabase Storage media/{restaurant_id}/items/, tags: vegan, vegetarian, gluten-free, spicy). Drag to reorder items. "Preview menu" opens the customer view rendered from get_public_menu. Managers: edit only if manager_can_edit_menu, otherwise only the sold-out switch.
4. Tables & QR (/app/tables): list of tables (add, rename, deactivate, reorder). Download QR as PDF (pdf-lib + qrcode): (a) table tents A6 with restaurant name, "Scan to order", table label; (b) sticker sheet; (c) one QR per page. Pickup QR (no table). QR URL format: {CUSTOMER_MENU_URL}/?r={slug}&table={label} (add NEXT_PUBLIC_CUSTOMER_MENU_URL to env example).
5. Settings (/app/settings) with tabs:
   - Profile: name, logo upload, brand colour, address, phone, website.
   - Ordering: is_open, prep_minutes, min order, table_contact (none/optional), pickup_contact (email/phone/email_or_phone).
   - Payments (owner only): pay_mode (counter/stripe) with a note "Stripe is connected by MyPlanetServices"; tax_rate.
   - Notifications: telegram_enabled switch (read-only telegram status).
   - Customer emails: sender name, reply-to, ready message.
   Managers only see the Ordering tab with only the open/close switch.
6. Team (/app/team) (owner only) v1: People list (name, email, role, remove), "Invite manager" dialog; Kitchen devices list (name, last seen, status) with "Add kitchen device" (shows the 6-digit code large with a 10-minute countdown and instructions "Open kitchen.myplanetservices.com/kitchen/pair on the tablet") and Revoke; permission switches (kitchen_can_soldout, manager_can_edit_menu).

All writes go through Server Actions that call requireRole() and validate with zod, and log to activity_log (menu changes, settings changes, open/close).

At the end, report files, and a test list using seeded users owner.a and manager.a (what each can and cannot do), plus a realtime test: insert a test order with a script and see it appear on the Orders board with sound.
```

---

## PROMPT 4: Kitchen screen

```
Read IMPLEMENTATION_PLAN.md (sections 3, 4, 6 "Kitchen area") and .agents/rules/project-rules.md. Follow them strictly.

Do PHASE 4 (kitchen screen) only.

Design rules: always dark (bg near-black #0B0F14, cards #151B23), very high contrast, huge text (order title 28–32px, items 22–24px), buttons at least 64px tall, no sidebar, no links to other areas, full-width 3-column layout on tablets (stack on narrow screens).

1. /kitchen layout: top strip with restaurant name, current time, online/offline dot (green/red using Supabase Realtime connection state + navigator.onLine), staff name (if a PIN was used) and a "Change cook" button. No other navigation.
2. Board: columns New | Cooking | Ready, data from kitchen_tickets only (never orders). Sort oldest first. Cards: big "Table X" or "Pickup – {first name}", order number, items (qty × name) and item notes, order notes in red, timer with colour (green < 10, orange 10–20, red > 20 min, red cards pulse gently).
3. Realtime subscription on kitchen_tickets for this restaurant. New order: loud chime (respect browser autoplay: show a "Tap to enable sound" banner until the first tap) + card flash for 3 seconds.
4. Actions (call set_order_status through a Server Action that checks the kitchen role): Start (New → Cooking), Ready (Cooking → Ready or New → Ready), Problem (dialog with big buttons: Out of stock, Kitchen issue, Other + optional note), Collected (Ready → Collected, hides the card). "Recent" drawer with the last 10 actions and Undo.
5. Sold-out panel (only if kitchen_can_soldout): button "Sold out items" opens a sheet listing menu item names with large switches (server action updates menu_items.available only).
6. Staff PIN (only if the restaurant has active PINs): at load and on "Change cook", show a large numeric keypad to enter a 4-digit PIN (verifyStaffPin); the name is kept in sessionStorage and sent as staff_name with each action. Allow "Skip" only if no PINs exist.
7. Keep the screen awake with the Wake Lock API (re-request on visibility change). Update kitchen_devices.last_seen_at every 60 seconds.
8. If the device is revoked or the session ends, show "This device was disconnected. Ask the owner for a new pairing code" and a button to /kitchen/pair.

Prices, totals, emails and phone numbers must never be fetched or displayed.

At the end, report files and a test list: pair a device for Restaurant A, create orders with a script, check realtime under 2 seconds, sound, all actions and undo, sold-out panel on/off via the owner setting, PIN flow, revoke from the owner Team page.
```

---

## PROMPT 5: Admin area v1

```
Read IMPLEMENTATION_PLAN.md (sections 6 "Admin area", 7) and .agents/rules/project-rules.md. Follow them strictly.

Do PHASE 5 (admin v1) only. Only users in platform_admins can access /admin (enforced server-side).

Design: same style as the owner area but denser; left sidebar: Clients, Errors, Announcements.

1. Clients list (/admin): table with name, slug, status badge, plan, joined date, orders today, last order time, kitchen device online (any device seen in the last 5 min), billing status. Search, filter by status, sort.
2. Add client (dialog): restaurant name, slug (auto from name, editable, must be unique, check live), owner name, owner email, plan name, monthly amount. Server action creates: restaurant (status setting_up, timezone America/Chicago, tax_rate 0.0825, pay_mode counter), tables 1–10, billing row, owner invite (from phase 2). Writes activity_log.
3. Client detail (/admin/clients/[id]): overview (status, onboarding checklist progress from restaurants.onboarding), key settings (read-only), billing (edit plan, amount, next due date, status), actions: Activate, Pause, Cancel (confirm dialogs), Resend owner invite.
4. View as owner: button opens /app for that restaurant in read-only mode (a banner "Viewing as admin – read only" and all write actions disabled server-side when the admin-view cookie is set). Log start and end in activity_log.
5. Errors (/admin/errors): list of error_logs (create a migration for table error_logs: id, workflow, node, message, link, restaurant_slug, created_at; RLS admin only).
6. Announcements (/admin/announcements): create, activate/deactivate, delete. Active announcements show as a dismissible banner on the owner Home.

At the end, report files and tests: log in as admin, add a client with a new email, accept the invite as that owner, pause the client and confirm the owner sees a "Paused" notice and the customer menu (get_public_menu) no longer returns it.
```

---

## PROMPT 6: Connect the ordering system (n8n)

```
Read IMPLEMENTATION_PLAN.md (section 8) and .agents/rules/project-rules.md. Follow them strictly.

Do PHASE 6 (integration) only. The existing ordering kit is in the folder ordering-kit/ (I will copy it in: menu-page/index.html, menu-page/thanks.html, workflows/*.json).

1. Customer menu page (ordering-kit/menu-page/index.html):
   - Load the menu by calling the Supabase RPC get_public_menu(slug) with the anon key (REST: POST {SUPABASE_URL}/rest/v1/rpc/get_public_menu). Keep the n8n checkout call as it is.
   - Apply contact rules from the menu data: table orders → name optional, "Email me when it's ready" checkbox; pickup orders → name required + email/phone per pickup_contact.
   - Keep the existing look; only change what is needed. Put SUPABASE_URL and ANON key as constants at the top with comments.
2. Route handler POST /api/n8n/error: checks header x-n8n-secret == N8N_SHARED_SECRET, stores the error in error_logs.
3. Database webhook setup instructions (Supabase Dashboard → Database Webhooks): on orders UPDATE → call N8N_READY_WEBHOOK_URL. Write the exact settings in docs/n8n-setup.md.
4. docs/n8n-setup.md: step-by-step plain-English instructions for changing each n8n workflow from Google Sheets to Supabase (Postgres/Supabase nodes with the service role), including the exact SQL/RPC for:
   - Checkout: read restaurant by slug (status trial/active, is_open), read menu_items prices, insert orders (status pending_payment for online pay, new for counter) + order_items, return order_number.
   - Payment confirmed (Stripe and Razorpay): update payment_status = paid and status = new where status = pending_payment.
   - Ready email: receives the webhook, only continues when status changed to ready and customer_email is present, sends the email with sender name and reply-to from restaurants.
   - Error alerts: also POST to /api/n8n/error.
   - Telegram backup: only send when restaurants.telegram_enabled = true; Telegram Ready button calls set_order_status via RPC with the service role.
5. Create a Postgres function create_order(payload jsonb) (security definer, callable only by service_role) that validates items against menu_items (available + visible), calculates subtotal/tax/total from the database prices, applies contact rules, inserts the order and items in one transaction, and returns { order_id, order_number, total_cents }. n8n Checkout must use this function.
6. Updated workflow JSON files are NOT required from you; the guide in docs/n8n-setup.md is enough.

At the end, report files and a test list: open the menu page with ?r=lone-star-tacos&table=5, place a counter order (via create_order called from a script that mimics n8n), see it on the kitchen screen and owner Orders board, mark Ready, confirm the webhook fires.
```

---

## PROMPT 7: Version 2 features

```
Read IMPLEMENTATION_PLAN.md (sections 6, 7) and .agents/rules/project-rules.md. Follow them strictly.

Do PHASE 7 only: replace every "Coming soon" page and finish the owner features. Same design rules as phase 3.

1. Order history (/app/history): table with search (order number, customer, table), filters (date range, status, payment mode, order type), pagination, order detail sheet with timeline (created, started, ready, collected, who did it), CSV export (server route, owner + manager).
2. Reports (/app/reports, owner only): period picker (today, 7 days, 30 days, custom) with comparison to previous period; cards (sales, orders, average order); line chart sales per day; bar chart top 10 items and bottom 5 items; busy-hours heat map (weekday × hour); table report (orders and sales per table); kitchen speed (average and 90th percentile minutes from new to ready, late orders count); payment split (counter vs online). All queries filtered by restaurant and timezone.
3. Customers (/app/customers, owner only): list of customers with marketing_consent = true (name, email, phone, orders, total spent, last visit), search, CSV export.
4. Opening hours (Settings → Hours tab): weekly hours per day (closed / open–close, multiple ranges not needed), closures by date. Add a database function is_open_now(restaurant_id) used by get_public_menu and create_order: ordering is open only if is_open = true AND within hours AND not a closure.
5. Activity log (/app/activity, owner only): filter by actor type and date, paginated.
6. Team v2: Staff PINs section (add name → show PIN once, reset, remove); change member role (owner ↔ manager, cannot remove the last owner); manager permission switches already exist.
7. Setup checklist on Home: Profile, Menu (at least 3 items), Tables & QR downloaded, Payments chosen, Kitchen (device paired or Telegram enabled), Team (optional), Test order, Go live. Store progress in restaurants.onboarding. "Place test order" creates an order with is_test = true through create_order (server action). "Go live" (owner) sets status active when required steps are done and logs it. Test orders are excluded from reports and customers.
8. Billing (/app/billing, owner only): plan, amount, next due date, status from billing (read-only) + "Contact us about billing" button.
9. Help (/app/help): short guides (how to mark sold out, add a dish, pair a kitchen tablet, print QR codes, open/close) and a "Request help" form that stores a row in a new support_requests table (migration with RLS: owner/manager insert own, admin read all) and shows in a new admin page /admin/support.

At the end, report files and a test list for every page with owner.a and manager.a.
```

---

## PROMPT 8: Hardening

```
Read IMPLEMENTATION_PLAN.md (section 10) and .agents/rules/project-rules.md. Follow them strictly.

Do PHASE 8 only. Do not add new features.

1. Extend scripts/test-isolation.ts to cover every table and function added since phase 1 (including kitchen_tickets, error_logs, support_requests, create_order, set_order_status) and every checklist item in section 10 that can be automated. All must PASS.
2. Review every Server Action and Route Handler: confirm requireRole() is called, input is validated with zod, and admin "view as owner" is read-only. List any fixes made.
3. Confirm no client component imports lib/supabase/admin.ts or reads non-public env vars (add a check script or ESLint rule).
4. Add loading skeletons, empty states and friendly error messages where missing; add app/error.tsx and app/not-found.tsx.
5. Mobile check of every owner page at 375px width and the kitchen screen at 1024×768; fix layout issues.
6. Accessibility: labels on all inputs, focus states, colour contrast AA, aria-labels on icon buttons.
7. Performance: database indexes for report queries, avoid N+1 queries, paginate long lists.
8. Rate limits on /api/kitchen/pair, login link requests (per email), and /api/n8n/error.

At the end, report the full test output, fixes made, and anything you could not automate (as a manual checklist for me).
```

---

## PROMPT 9: Launch

```
Read IMPLEMENTATION_PLAN.md (section 9) and .agents/rules/project-rules.md. Follow them strictly.

Do PHASE 9 only. Mostly configuration and documentation. Do not add features.

1. Production build and deploy to Cloudflare with @opennextjs/cloudflare. Set production environment variables in Cloudflare (list them).
2. Custom domains: dashboard.myplanetservices.com and kitchen.myplanetservices.com (both point to the same app; requests to the kitchen domain root redirect to /kitchen, and /app or /admin on the kitchen domain redirect to /kitchen).
3. Supabase production settings: Site URL and redirect URLs for both domains; custom SMTP for auth emails (step-by-step for Brevo or Resend); email templates for login link and invite with MyPlanetServices branding and plain wording.
4. Remove the development password login from production builds (confirm it is not rendered when NODE_ENV=production).
5. Remove seeded demo users and demo data from production (script with confirmation prompt), keep the schema.
6. Backups: describe Supabase backup options for my plan and add a weekly CSV export of orders per restaurant (route handler protected by a secret, callable from n8n).
7. Monitoring: health route /api/health (checks database connection) for an uptime monitor; document how to connect a free uptime monitor.
8. Write docs/launch-checklist.md and docs/onboarding-guide.md (plain English: how I add a client, how the owner sets up, how the kitchen tablet is paired).

At the end, report everything I must do manually, in order, with exact clicks and values.
```
