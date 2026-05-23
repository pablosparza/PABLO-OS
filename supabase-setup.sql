-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Creates the cache table Pablo OS needs

create table if not exists cache (
  key text primary key,
  payload jsonb not null,
  updated_at timestamptz default now()
);

-- Allow the API to read/write cache
alter table cache enable row level security;
create policy "service_role_full_access" on cache for all using (true) with check (true);
