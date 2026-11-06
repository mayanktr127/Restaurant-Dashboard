-- Migration 1: Tables, Constraints, and Indexes
-- Implementation Plan Section 5

create extension if not exists "pgcrypto";

-- 1. Restaurants
create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  logo_url text,
  brand_color text,
  address text,
  phone text,
  website text,
  timezone text not null default 'America/Chicago',
  status text not null default 'setting_up' check (status in ('setting_up', 'trial', 'active', 'paused', 'cancelled')),
  plan_name text,
  tax_rate numeric not null default 0,
  prep_minutes integer not null default 15,
  is_open boolean not null default true,
  pay_mode text not null default 'counter' check (pay_mode in ('counter', 'stripe')),
  table_contact text not null default 'none' check (table_contact in ('none', 'optional')),
  pickup_contact text not null default 'email_or_phone' check (pickup_contact in ('email', 'phone', 'email_or_phone')),
  min_order_cents integer not null default 0,
  telegram_chat_id text,
  telegram_enabled boolean not null default false,
  customer_email_sender_name text,
  customer_email_reply_to text,
  ready_message text,
  kitchen_can_soldout boolean not null default true,
  manager_can_edit_menu boolean not null default false,
  onboarding jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 2. Platform Admins
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 3. Memberships
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'kitchen')),
  display_name text,
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint memberships_user_restaurant_unique unique (user_id, restaurant_id)
);

-- 4. Staff PINs
create table if not exists public.staff_pins (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  display_name text not null,
  pin_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 5. Kitchen Devices
create table if not exists public.kitchen_devices (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- 6. Pairing Codes
create table if not exists public.pairing_codes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 7. Invites
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'manager', 'kitchen')),
  token_hash text not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 8. Categories
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);

-- 9. Menu Items
create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null default 0,
  photo_url text,
  available boolean not null default true,
  visible boolean not null default true,
  sort_order integer not null default 0,
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

-- 10. Tables
create table if not exists public.tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  label text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 11. Orders
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_number text not null,
  order_type text not null check (order_type in ('table', 'pickup')),
  table_label text,
  customer_name text,
  customer_email text,
  customer_phone text,
  notes text,
  subtotal_cents integer not null default 0,
  tax_cents integer not null default 0,
  total_cents integer not null default 0,
  payment_mode text,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'pending', 'paid', 'refunded')),
  provider_ref text,
  status text not null default 'new' check (status in ('pending_payment', 'new', 'cooking', 'ready', 'collected', 'problem', 'cancelled')),
  problem_reason text,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ready_at timestamptz,
  collected_at timestamptz,
  started_by text,
  ready_by text,
  constraint orders_restaurant_order_number_unique unique (restaurant_id, order_number)
);

-- 12. Order Items
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  name text not null,
  unit_price_cents integer not null default 0,
  qty integer not null default 1,
  notes text,
  created_at timestamptz not null default now()
);

-- 13. Kitchen Tickets
create table if not exists public.kitchen_tickets (
  order_id uuid primary key references public.orders(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_number text not null,
  order_type text not null check (order_type in ('table', 'pickup')),
  table_label text,
  customer_first_name text,
  notes text,
  items jsonb not null default '[]'::jsonb,
  status text not null check (status in ('new', 'cooking', 'ready', 'collected', 'problem', 'cancelled')),
  problem_reason text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ready_at timestamptz
);

-- 14. Customers
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text,
  email text,
  phone text,
  marketing_consent boolean not null default false,
  orders_count integer not null default 0,
  total_spent_cents integer not null default 0,
  first_order_at timestamptz,
  last_order_at timestamptz,
  created_at timestamptz not null default now()
);

-- 15. Opening Hours
create table if not exists public.opening_hours (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  created_at timestamptz not null default now()
);

-- 16. Closures
create table if not exists public.closures (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  date date not null,
  reason text,
  created_at timestamptz not null default now()
);

-- 17. Activity Log
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  actor_type text not null check (actor_type in ('admin', 'owner', 'manager', 'kitchen', 'system')),
  actor_name text not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 18. Billing
create table if not exists public.billing (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  plan_name text not null,
  amount_cents integer not null default 0,
  next_due_date date,
  status text not null default 'paid' check (status in ('paid', 'due', 'overdue', 'paused')),
  created_at timestamptz not null default now()
);

-- 19. Announcements
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_memberships_restaurant_id on public.memberships(restaurant_id);
create index if not exists idx_memberships_user_id on public.memberships(user_id);
create index if not exists idx_staff_pins_restaurant_id on public.staff_pins(restaurant_id);
create index if not exists idx_kitchen_devices_restaurant_id on public.kitchen_devices(restaurant_id);
create index if not exists idx_pairing_codes_restaurant_id on public.pairing_codes(restaurant_id);
create index if not exists idx_invites_restaurant_id on public.invites(restaurant_id);
create index if not exists idx_categories_restaurant_id on public.categories(restaurant_id);
create index if not exists idx_menu_items_restaurant_id on public.menu_items(restaurant_id);
create index if not exists idx_menu_items_category_id on public.menu_items(category_id);
create index if not exists idx_tables_restaurant_id on public.tables(restaurant_id);
create index if not exists idx_orders_restaurant_id on public.orders(restaurant_id);
create index if not exists idx_orders_restaurant_status_created on public.orders(restaurant_id, status, created_at);
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_order_items_restaurant_id on public.order_items(restaurant_id);
create index if not exists idx_kitchen_tickets_restaurant_id on public.kitchen_tickets(restaurant_id);
create index if not exists idx_customers_restaurant_id on public.customers(restaurant_id);
create index if not exists idx_customers_email on public.customers(restaurant_id, email);
create index if not exists idx_customers_phone on public.customers(restaurant_id, phone);
create index if not exists idx_opening_hours_restaurant_id on public.opening_hours(restaurant_id);
create index if not exists idx_closures_restaurant_id on public.closures(restaurant_id);
create index if not exists idx_activity_log_restaurant_id on public.activity_log(restaurant_id);
create index if not exists idx_activity_log_created_at on public.activity_log(restaurant_id, created_at desc);

