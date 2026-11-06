-- Migration 2: Functions, Triggers, and Views
-- Implementation Plan Section 5

-- 1. Helper function: is_platform_admin()
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins
    where user_id = auth.uid()
  );
$$;

-- 2. Helper function: has_role(rid, roles[])
create or replace function public.has_role(rid uuid, roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    public.is_platform_admin()
    or exists (
      select 1
      from public.memberships
      where restaurant_id = rid
        and user_id = auth.uid()
        and active = true
        and role = any(roles)
    )
  );
$$;

-- 3. Order number generator
create or replace function public.generate_order_number(rid uuid)
returns text
language plpgsql
volatile
as $$
declare
  chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  candidate text;
  is_unique boolean := false;
  attempts integer := 0;
begin
  while not is_unique and attempts < 100 loop
    candidate := '';
    for i in 1..5 loop
      candidate := candidate || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    end loop;

    if not exists (select 1 from public.orders where restaurant_id = rid and order_number = candidate) then
      is_unique := true;
    end if;

    attempts := attempts + 1;
  end loop;

  if not is_unique then
    raise exception 'Could not generate unique order number after 100 attempts';
  end if;

  return candidate;
end;
$$;

-- 4. set_order_status
create or replace function public.set_order_status(
  p_order_id uuid,
  p_new_status text,
  p_reason text default null,
  p_staff_name text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_old_status text;
  v_target_status text := p_new_status;
  v_actor_type text := 'system';
  v_actor_name text;
  v_user_id uuid := auth.uid();
  v_last_log record;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;

  -- Role check: Admin, Owner, Manager, Kitchen of that restaurant
  if not (
    public.is_platform_admin()
    or exists (
      select 1 from public.memberships
      where restaurant_id = v_order.restaurant_id
        and user_id = v_user_id
        and active = true
        and role in ('owner', 'manager', 'kitchen')
    )
  ) then
    raise exception 'Permission denied for order %', p_order_id;
  end if;

  -- Determine actor role and name
  if public.is_platform_admin() then
    v_actor_type := 'admin';
  else
    select role into v_actor_type
    from public.memberships
    where restaurant_id = v_order.restaurant_id
      and user_id = v_user_id
      and active = true
    limit 1;
  end if;

  select coalesce(p_staff_name, display_name, email, 'Staff') into v_actor_name
  from public.memberships
  where restaurant_id = v_order.restaurant_id and user_id = v_user_id
  limit 1;

  if v_actor_name is null then
    v_actor_name := coalesce(p_staff_name, 'Staff');
  end if;

  v_old_status := v_order.status;

  -- Handle Undo
  if p_new_status = 'undo' then
    select details->>'previous_status' as prev_status into v_last_log
    from public.activity_log
    where restaurant_id = v_order.restaurant_id
      and action = 'status_change'
      and (details->>'order_id')::uuid = p_order_id
      and created_at >= (now() - interval '10 minutes')
    order by created_at desc
    limit 1;

    if v_last_log.prev_status is null then
      raise exception 'No status change found within the last 10 minutes to undo';
    end if;

    v_target_status := v_last_log.prev_status;
  else
    -- Validate transition:
    -- new->cooking, cooking->ready, new->ready, ready->collected, any->problem, problem->new
    if not (
      (v_old_status = 'new' and v_target_status in ('cooking', 'ready')) or
      (v_old_status = 'cooking' and v_target_status = 'ready') or
      (v_old_status = 'ready' and v_target_status = 'collected') or
      (v_target_status = 'problem') or
      (v_old_status = 'problem' and v_target_status = 'new')
    ) then
      raise exception 'Invalid status transition from % to %', v_old_status, v_target_status;
    end if;
  end if;

  -- Apply status change and timestamps
  update public.orders
  set
    status = v_target_status,
    problem_reason = case when v_target_status = 'problem' then coalesce(p_reason, problem_reason) else null end,
    started_at = case
      when v_target_status = 'cooking' and started_at is null then now()
      else started_at
    end,
    started_by = case
      when v_target_status = 'cooking' and started_by is null then coalesce(p_staff_name, v_actor_name)
      else started_by
    end,
    ready_at = case
      when v_target_status = 'ready' and ready_at is null then now()
      else ready_at
    end,
    ready_by = case
      when v_target_status = 'ready' and ready_by is null then coalesce(p_staff_name, v_actor_name)
      else ready_by
    end,
    collected_at = case
      when v_target_status = 'collected' and collected_at is null then now()
      else collected_at
    end
  where id = p_order_id
  returning * into v_order;

  -- Write activity log
  insert into public.activity_log (
    restaurant_id,
    actor_type,
    actor_name,
    action,
    details
  ) values (
    v_order.restaurant_id,
    v_actor_type,
    v_actor_name,
    'status_change',
    jsonb_build_object(
      'order_id', p_order_id,
      'previous_status', v_old_status,
      'new_status', v_target_status,
      'reason', p_reason
    )
  );

  return v_order;
end;
$$;

-- 5. get_public_menu(slug)
create or replace function public.get_public_menu(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_restaurant public.restaurants%rowtype;
  v_result jsonb;
begin
  select * into v_restaurant
  from public.restaurants
  where slug = p_slug and status in ('trial', 'active');

  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'id', v_restaurant.id,
    'slug', v_restaurant.slug,
    'name', v_restaurant.name,
    'logo_url', v_restaurant.logo_url,
    'brand_color', v_restaurant.brand_color,
    'is_open', v_restaurant.is_open,
    'prep_minutes', v_restaurant.prep_minutes,
    'tax_rate', v_restaurant.tax_rate,
    'pay_mode', v_restaurant.pay_mode,
    'table_contact', v_restaurant.table_contact,
    'pickup_contact', v_restaurant.pickup_contact,
    'min_order_cents', v_restaurant.min_order_cents,
    'categories', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', c.id,
            'name', c.name,
            'sort_order', c.sort_order,
            'items', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'id', m.id,
                    'name', m.name,
                    'description', m.description,
                    'price_cents', m.price_cents,
                    'photo_url', m.photo_url,
                    'available', m.available,
                    'sort_order', m.sort_order,
                    'tags', m.tags
                  ) order by m.sort_order, m.created_at
                )
                from public.menu_items m
                where m.category_id = c.id
                  and m.visible = true
              ),
              '[]'::jsonb
            )
          ) order by c.sort_order, c.created_at
        )
        from public.categories c
        where c.restaurant_id = v_restaurant.id
          and c.visible = true
      ),
      '[]'::jsonb
    )
  ) into v_result;

  return v_result;
end;
$$;

-- 6. Trigger: sync kitchen_tickets from orders and order_items
create or replace function public.sync_kitchen_tickets()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order public.orders%rowtype;
  v_items jsonb;
  v_first_name text;
begin
  if tg_table_name = 'orders' then
    v_order_id := coalesce(new.id, old.id);
  else
    v_order_id := coalesce(new.order_id, old.order_id);
  end if;

  select * into v_order from public.orders where id = v_order_id;
  if not found then
    delete from public.kitchen_tickets where order_id = v_order_id;
    return coalesce(new, old);
  end if;

  -- Do not show pending_payment orders on kitchen screen
  if v_order.status = 'pending_payment' then
    delete from public.kitchen_tickets where order_id = v_order_id;
    return coalesce(new, old);
  end if;

  -- Collect items
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', oi.name,
        'qty', oi.qty,
        'notes', oi.notes
      ) order by oi.created_at
    ),
    '[]'::jsonb
  ) into v_items
  from public.order_items oi
  where oi.order_id = v_order_id;

  -- Customer first name
  v_first_name := split_part(trim(coalesce(v_order.customer_name, '')), ' ', 1);
  if v_first_name = '' then
    v_first_name := null;
  end if;

  insert into public.kitchen_tickets (
    order_id,
    restaurant_id,
    order_number,
    order_type,
    table_label,
    customer_first_name,
    notes,
    items,
    status,
    problem_reason,
    created_at,
    started_at,
    ready_at
  ) values (
    v_order.id,
    v_order.restaurant_id,
    v_order.order_number,
    v_order.order_type,
    v_order.table_label,
    v_first_name,
    v_order.notes,
    v_items,
    v_order.status,
    v_order.problem_reason,
    v_order.created_at,
    v_order.started_at,
    v_order.ready_at
  )
  on conflict (order_id) do update set
    order_number = excluded.order_number,
    order_type = excluded.order_type,
    table_label = excluded.table_label,
    customer_first_name = excluded.customer_first_name,
    notes = excluded.notes,
    items = excluded.items,
    status = excluded.status,
    problem_reason = excluded.problem_reason,
    started_at = excluded.started_at,
    ready_at = excluded.ready_at;

  return coalesce(new, old);
end;
$$;

create or replace trigger trg_orders_sync_kitchen_tickets
after insert or update of status, order_number, order_type, table_label, customer_name, notes, problem_reason, started_at, ready_at
on public.orders
for each row
execute function public.sync_kitchen_tickets();

create or replace trigger trg_order_items_sync_kitchen_tickets
after insert or update or delete
on public.order_items
for each row
execute function public.sync_kitchen_tickets();

-- 7. Trigger: upsert customers when order becomes 'new'
create or replace function public.upsert_customer_on_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean_email text := lower(trim(coalesce(new.customer_email, '')));
  v_clean_phone text := trim(coalesce(new.customer_phone, ''));
  v_customer_id uuid;
begin
  if new.status = 'new' and (old is null or old.status != 'new') then
    if v_clean_email != '' or v_clean_phone != '' then
      -- Search existing customer in this restaurant
      if v_clean_email != '' then
        select id into v_customer_id
        from public.customers
        where restaurant_id = new.restaurant_id and lower(email) = v_clean_email
        limit 1;
      elsif v_clean_phone != '' then
        select id into v_customer_id
        from public.customers
        where restaurant_id = new.restaurant_id and phone = v_clean_phone
        limit 1;
      end if;

      if v_customer_id is not null then
        update public.customers
        set
          name = coalesce(new.customer_name, name),
          email = case when v_clean_email != '' then v_clean_email else email end,
          phone = case when v_clean_phone != '' then v_clean_phone else phone end,
          orders_count = orders_count + 1,
          total_spent_cents = total_spent_cents + new.total_cents,
          last_order_at = new.created_at
        where id = v_customer_id;
      else
        insert into public.customers (
          restaurant_id,
          name,
          email,
          phone,
          marketing_consent,
          orders_count,
          total_spent_cents,
          first_order_at,
          last_order_at
        ) values (
          new.restaurant_id,
          new.customer_name,
          case when v_clean_email != '' then v_clean_email else null end,
          case when v_clean_phone != '' then v_clean_phone else null end,
          false,
          1,
          new.total_cents,
          new.created_at,
          new.created_at
        );
      end if;
    end if;
  end if;

  return new;
end;
$$;

create or replace trigger trg_orders_upsert_customer
after insert or update of status
on public.orders
for each row
execute function public.upsert_customer_on_order();

-- 8. View daily_stats with security_invoker = true
create or replace view public.daily_stats
with (security_invoker = true)
as
select
  restaurant_id,
  date(created_at) as day,
  count(id)::integer as orders_count,
  coalesce(sum(total_cents), 0)::bigint as sales_cents,
  case
    when count(id) > 0 then round(avg(total_cents))::integer
    else 0
  end as avg_order_cents
from public.orders
where status in ('new', 'cooking', 'ready', 'collected')
group by restaurant_id, date(created_at);

