-- Migration 3: Row Level Security (RLS)
-- Implementation Plan Section 5

-- Enable RLS on every table
alter table public.restaurants enable row level security;
alter table public.platform_admins enable row level security;
alter table public.memberships enable row level security;
alter table public.staff_pins enable row level security;
alter table public.kitchen_devices enable row level security;
alter table public.pairing_codes enable row level security;
alter table public.invites enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.tables enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.kitchen_tickets enable row level security;
alter table public.customers enable row level security;
alter table public.opening_hours enable row level security;
alter table public.closures enable row level security;
alter table public.activity_log enable row level security;
alter table public.billing enable row level security;
alter table public.announcements enable row level security;

-- 1. Restaurants policies
create policy "Admin full access to restaurants"
  on public.restaurants for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Owner read own restaurant"
  on public.restaurants for select
  to authenticated
  using (public.has_role(id, array['owner']));

create policy "Owner update own restaurant"
  on public.restaurants for update
  to authenticated
  using (public.has_role(id, array['owner']))
  with check (public.has_role(id, array['owner']));

create policy "Manager read own restaurant"
  on public.restaurants for select
  to authenticated
  using (public.has_role(id, array['manager']));

create policy "Manager update is_open on own restaurant"
  on public.restaurants for update
  to authenticated
  using (public.has_role(id, array['manager']))
  with check (public.has_role(id, array['manager']));

-- 2. Platform Admins policies
create policy "Admin access to platform_admins"
  on public.platform_admins for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- 3. Memberships policies
create policy "Admin full access to memberships"
  on public.memberships for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Owner full access to memberships of own restaurant"
  on public.memberships for all
  to authenticated
  using (public.has_role(restaurant_id, array['owner']))
  with check (public.has_role(restaurant_id, array['owner']));

create policy "Users can view own memberships"
  on public.memberships for select
  to authenticated
  using (user_id = auth.uid());

-- 4. Staff PINs policies
create policy "Admin full access to staff_pins"
  on public.staff_pins for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Owner full access to staff_pins of own restaurant"
  on public.staff_pins for all
  to authenticated
  using (public.has_role(restaurant_id, array['owner']))
  with check (public.has_role(restaurant_id, array['owner']));

create policy "Kitchen read active staff_pins of own restaurant"
  on public.staff_pins for select
  to authenticated
  using (public.has_role(restaurant_id, array['kitchen']) and active = true);

-- 5. Kitchen Devices policies
create policy "Admin full access to kitchen_devices"
  on public.kitchen_devices for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Owner full access to kitchen_devices of own restaurant"
  on public.kitchen_devices for all
  to authenticated
  using (public.has_role(restaurant_id, array['owner']))
  with check (public.has_role(restaurant_id, array['owner']));

-- 6. Pairing Codes policies
create policy "Admin full access to pairing_codes"
  on public.pairing_codes for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Owner full access to pairing_codes of own restaurant"
  on public.pairing_codes for all
  to authenticated
  using (public.has_role(restaurant_id, array['owner']))
  with check (public.has_role(restaurant_id, array['owner']));

-- 7. Invites policies
create policy "Admin full access to invites"
  on public.invites for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Owner full access to invites of own restaurant"
  on public.invites for all
  to authenticated
  using (public.has_role(restaurant_id, array['owner']))
  with check (public.has_role(restaurant_id, array['owner']));

-- 8. Categories policies
create policy "Admin full access to categories"
  on public.categories for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Owner full access to categories of own restaurant"
  on public.categories for all
  to authenticated
  using (public.has_role(restaurant_id, array['owner']))
  with check (public.has_role(restaurant_id, array['owner']));

create policy "Manager read categories of own restaurant"
  on public.categories for select
  to authenticated
  using (public.has_role(restaurant_id, array['manager']));

create policy "Manager manage categories if allowed"
  on public.categories for all
  to authenticated
  using (
    public.has_role(restaurant_id, array['manager'])
    and exists (select 1 from public.restaurants r where r.id = categories.restaurant_id and r.manager_can_edit_menu = true)
  )
  with check (
    public.has_role(restaurant_id, array['manager'])
    and exists (select 1 from public.restaurants r where r.id = categories.restaurant_id and r.manager_can_edit_menu = true)
  );

create policy "Kitchen read categories of own restaurant"
  on public.categories for select
  to authenticated
  using (public.has_role(restaurant_id, array['kitchen']));

-- 9. Menu Items policies
create policy "Admin full access to menu_items"
  on public.menu_items for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Owner full access to menu_items of own restaurant"
  on public.menu_items for all
  to authenticated
  using (public.has_role(restaurant_id, array['owner']))
  with check (public.has_role(restaurant_id, array['owner']));

create policy "Manager read menu_items of own restaurant"
  on public.menu_items for select
  to authenticated
  using (public.has_role(restaurant_id, array['manager']));

create policy "Manager update menu_items (available or full edit if allowed)"
  on public.menu_items for update
  to authenticated
  using (public.has_role(restaurant_id, array['manager']))
  with check (public.has_role(restaurant_id, array['manager']));

create policy "Manager insert menu_items if allowed"
  on public.menu_items for insert
  to authenticated
  with check (
    public.has_role(restaurant_id, array['manager'])
    and exists (select 1 from public.restaurants r where r.id = menu_items.restaurant_id and r.manager_can_edit_menu = true)
  );

create policy "Manager delete menu_items if allowed"
  on public.menu_items for delete
  to authenticated
  using (
    public.has_role(restaurant_id, array['manager'])
    and exists (select 1 from public.restaurants r where r.id = menu_items.restaurant_id and r.manager_can_edit_menu = true)
  );

create policy "Kitchen read menu_items of own restaurant"
  on public.menu_items for select
  to authenticated
  using (public.has_role(restaurant_id, array['kitchen']));

create policy "Kitchen update available on menu_items if allowed"
  on public.menu_items for update
  to authenticated
  using (
    public.has_role(restaurant_id, array['kitchen'])
    and exists (select 1 from public.restaurants r where r.id = menu_items.restaurant_id and r.kitchen_can_soldout = true)
  )
  with check (
    public.has_role(restaurant_id, array['kitchen'])
    and exists (select 1 from public.restaurants r where r.id = menu_items.restaurant_id and r.kitchen_can_soldout = true)
  );

-- 10. Tables policies
create policy "Admin full access to tables"
  on public.tables for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Owner full access to tables of own restaurant"
  on public.tables for all
  to authenticated
  using (public.has_role(restaurant_id, array['owner']))
  with check (public.has_role(restaurant_id, array['owner']));

create policy "Manager read tables of own restaurant"
  on public.tables for select
  to authenticated
  using (public.has_role(restaurant_id, array['manager']));

-- 11. Orders policies
-- Note: Kitchen is intentionally NOT granted SELECT on orders
create policy "Admin full access to orders"
  on public.orders for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Owner full access to orders of own restaurant"
  on public.orders for all
  to authenticated
  using (public.has_role(restaurant_id, array['owner']))
  with check (public.has_role(restaurant_id, array['owner']));

create policy "Manager read orders of own restaurant"
  on public.orders for select
  to authenticated
  using (public.has_role(restaurant_id, array['manager']));

-- 12. Order Items policies
-- Note: Kitchen is intentionally NOT granted SELECT on order_items
create policy "Admin full access to order_items"
  on public.order_items for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Owner full access to order_items of own restaurant"
  on public.order_items for all
  to authenticated
  using (public.has_role(restaurant_id, array['owner']))
  with check (public.has_role(restaurant_id, array['owner']));

create policy "Manager read order_items of own restaurant"
  on public.order_items for select
  to authenticated
  using (public.has_role(restaurant_id, array['manager']));

-- 13. Kitchen Tickets policies
create policy "Admin full access to kitchen_tickets"
  on public.kitchen_tickets for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Owner read kitchen_tickets of own restaurant"
  on public.kitchen_tickets for select
  to authenticated
  using (public.has_role(restaurant_id, array['owner']));

create policy "Manager read kitchen_tickets of own restaurant"
  on public.kitchen_tickets for select
  to authenticated
  using (public.has_role(restaurant_id, array['manager']));

create policy "Kitchen read kitchen_tickets of own restaurant"
  on public.kitchen_tickets for select
  to authenticated
  using (public.has_role(restaurant_id, array['kitchen']));

-- 14. Customers policies
-- Note: Manager and Kitchen are intentionally NOT granted access to customers
create policy "Admin full access to customers"
  on public.customers for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Owner full access to customers of own restaurant"
  on public.customers for all
  to authenticated
  using (public.has_role(restaurant_id, array['owner']))
  with check (public.has_role(restaurant_id, array['owner']));

-- 15. Opening Hours policies
create policy "Admin full access to opening_hours"
  on public.opening_hours for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Owner full access to opening_hours of own restaurant"
  on public.opening_hours for all
  to authenticated
  using (public.has_role(restaurant_id, array['owner']))
  with check (public.has_role(restaurant_id, array['owner']));

create policy "Manager read opening_hours of own restaurant"
  on public.opening_hours for select
  to authenticated
  using (public.has_role(restaurant_id, array['manager']));

-- 16. Closures policies
create policy "Admin full access to closures"
  on public.closures for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Owner full access to closures of own restaurant"
  on public.closures for all
  to authenticated
  using (public.has_role(restaurant_id, array['owner']))
  with check (public.has_role(restaurant_id, array['owner']));

create policy "Manager read closures of own restaurant"
  on public.closures for select
  to authenticated
  using (public.has_role(restaurant_id, array['manager']));

-- 17. Activity Log policies
-- Note: Manager and Kitchen are intentionally NOT granted access to activity_log
create policy "Admin full access to activity_log"
  on public.activity_log for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Owner read activity_log of own restaurant"
  on public.activity_log for select
  to authenticated
  using (public.has_role(restaurant_id, array['owner']));

-- 18. Billing policies
-- Note: Manager and Kitchen are intentionally NOT granted access to billing
create policy "Admin full access to billing"
  on public.billing for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Owner read billing of own restaurant"
  on public.billing for select
  to authenticated
  using (public.has_role(restaurant_id, array['owner']));

-- 19. Announcements policies
create policy "Admin full access to announcements"
  on public.announcements for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Authenticated users read active announcements"
  on public.announcements for select
  to authenticated
  using (active = true);

