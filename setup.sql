-- FreshTrack database setup
-- Run this once in Supabase Dashboard -> SQL Editor -> New query.

create extension if not exists pgcrypto;

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  product_name text not null check (char_length(product_name) between 1 and 120),
  location text not null check (char_length(location) between 1 and 120),
  prepared_at timestamptz not null,
  expires_at timestamptz not null,
  staff_initials text not null check (char_length(staff_initials) between 1 and 8),
  completed boolean not null default false,
  completed_at timestamptz,
  created_by uuid default auth.uid(),
  completed_by uuid,
  created_at timestamptz not null default now(),
  constraint expires_after_prepared check (expires_at > prepared_at)
);

create index if not exists inventory_items_expires_at_idx
  on public.inventory_items (expires_at);

create index if not exists inventory_items_completed_idx
  on public.inventory_items (completed);

alter table public.inventory_items enable row level security;

-- All signed-in employees share the same inventory.
-- Unauthenticated visitors have no table access.

drop policy if exists "Authenticated workers can view inventory" on public.inventory_items;
create policy "Authenticated workers can view inventory"
on public.inventory_items
for select
to authenticated
using (true);

drop policy if exists "Authenticated workers can add inventory" on public.inventory_items;
create policy "Authenticated workers can add inventory"
on public.inventory_items
for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists "Authenticated workers can update inventory" on public.inventory_items;
create policy "Authenticated workers can update inventory"
on public.inventory_items
for update
to authenticated
using (true)
with check (true);

-- No DELETE policy on purpose.
-- Completing an item updates it instead of deleting it, preserving history.

grant select, insert, update on public.inventory_items to authenticated;

-- Enable Postgres Changes for this table so open dashboards receive updates.
-- If Supabase reports that the table is already in the publication, that is okay.
alter publication supabase_realtime add table public.inventory_items;
