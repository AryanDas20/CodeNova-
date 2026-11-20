-- Wayfarer AI: private travel searches, itinerary plans, and share-card activity.
-- Run this migration in the Supabase SQL Editor for the connected project.

create extension if not exists pgcrypto;

create table if not exists public.wayfarer_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null check (activity_type in ('search', 'plan', 'share')),
  title text not null check (char_length(title) <= 180),
  destination text not null default '' check (char_length(destination) <= 180),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists wayfarer_activity_user_created_idx
  on public.wayfarer_activity (user_id, created_at desc);

alter table public.wayfarer_activity enable row level security;

-- Remove only these Wayfarer policies before recreating them, making this script rerunnable.
drop policy if exists wayfarer_activity_select_own on public.wayfarer_activity;
drop policy if exists wayfarer_activity_insert_own on public.wayfarer_activity;
drop policy if exists wayfarer_activity_delete_own on public.wayfarer_activity;

create policy wayfarer_activity_select_own
  on public.wayfarer_activity
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy wayfarer_activity_insert_own
  on public.wayfarer_activity
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy wayfarer_activity_delete_own
  on public.wayfarer_activity
  for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, delete on public.wayfarer_activity to authenticated;
