-- Migration 4: Realtime and Storage
-- Implementation Plan Section 5

-- 1. Realtime Publication
-- Add orders and kitchen_tickets to supabase_realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.orders;
    alter publication supabase_realtime add table public.kitchen_tickets;
  end if;
end $$;

-- 2. Storage Bucket: media (public read)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  5242880, -- 5MB limit
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = true;

-- Helper function to extract restaurant_id from storage object path: {restaurant_id}/filename.ext
create or replace function public.storage_restaurant_id(p_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  v_first_part text;
begin
  v_first_part := split_part(p_name, '/', 1);
  return v_first_part::uuid;
exception
  when others then
    return null;
end;
$$;

-- Storage Policies on storage.objects for 'media' bucket
-- Public read
create policy "Media Public Read"
  on storage.objects for select
  using (bucket_id = 'media');

-- Upload by Owner or Admin only: path format {restaurant_id}/...
create policy "Media Upload Owner Admin"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and (
      public.is_platform_admin()
      or (
        public.storage_restaurant_id(name) is not null
        and public.has_role(public.storage_restaurant_id(name), array['owner'])
      )
    )
  );

-- Update by Owner or Admin only
create policy "Media Update Owner Admin"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'media'
    and (
      public.is_platform_admin()
      or (
        public.storage_restaurant_id(name) is not null
        and public.has_role(public.storage_restaurant_id(name), array['owner'])
      )
    )
  )
  with check (
    bucket_id = 'media'
    and (
      public.is_platform_admin()
      or (
        public.storage_restaurant_id(name) is not null
        and public.has_role(public.storage_restaurant_id(name), array['owner'])
      )
    )
  );

-- Delete by Owner or Admin only
create policy "Media Delete Owner Admin"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'media'
    and (
      public.is_platform_admin()
      or (
        public.storage_restaurant_id(name) is not null
        and public.has_role(public.storage_restaurant_id(name), array['owner'])
      )
    )
  );

