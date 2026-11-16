-- BASE starter schema. Run in Supabase SQL editor after creating a project.
create extension if not exists pgcrypto;
create table if not exists public.workspaces (
 id uuid primary key default gen_random_uuid(), name text not null,
 created_by uuid not null, created_at timestamptz not null default now()
);
create table if not exists public.workspace_members (
 workspace_id uuid references public.workspaces(id) on delete cascade,
 user_id uuid not null, role text not null check(role in ('creator','brand_owner','reviewer','admin')),
 primary key(workspace_id,user_id)
);
create table if not exists public.brand_sources (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 name text not null, source_type text not null, body text not null, version text not null default 'v1.0',
 owner_id uuid not null, review_due date, created_at timestamptz not null default now()
);
create table if not exists public.reviews (
 id uuid primary key default gen_random_uuid(), workspace_id uuid references public.workspaces(id) on delete cascade,
 owner_uid uuid, title text not null, channel text, content text not null,
 status text not null default 'Needs review', findings jsonb not null default '[]',
 brand_pack_version text, created_at timestamptz not null default now()
);
create table if not exists public.review_events (
 id uuid primary key default gen_random_uuid(), review_id uuid references public.reviews(id) on delete cascade,
 actor_uid uuid not null, event_type text not null, details jsonb not null default '{}',
 created_at timestamptz not null default now()
);
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.brand_sources enable row level security;
alter table public.reviews enable row level security;
alter table public.review_events enable row level security;
-- Membership checks. Keep policies narrow; service-side admin actions belong in Edge Functions.
create or replace function public.is_workspace_member(wid uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.workspace_members m where m.workspace_id=wid and m.user_id=auth.uid()) $$;
create policy "members can read own workspace" on public.workspaces for select using (public.is_workspace_member(id));
create policy "members can read membership" on public.workspace_members for select using (user_id=auth.uid() or public.is_workspace_member(workspace_id));
create policy "members can read sources" on public.brand_sources for select using (public.is_workspace_member(workspace_id));
create policy "owners manage sources" on public.brand_sources for all using (
 exists(select 1 from public.workspace_members m where m.workspace_id=workspace_id and m.user_id=auth.uid() and m.role in ('brand_owner','admin'))
) with check (
 exists(select 1 from public.workspace_members m where m.workspace_id=workspace_id and m.user_id=auth.uid() and m.role in ('brand_owner','admin'))
);
create policy "members read reviews" on public.reviews for select using (public.is_workspace_member(workspace_id));
create policy "members create reviews" on public.reviews for insert with check (owner_uid=auth.uid() and public.is_workspace_member(workspace_id));
create policy "review owner or reviewer update" on public.reviews for update using (
 owner_uid=auth.uid() or exists(select 1 from public.workspace_members m where m.workspace_id=workspace_id and m.user_id=auth.uid() and m.role in ('reviewer','admin'))
);
create policy "members read review events" on public.review_events for select using (
 exists(select 1 from public.reviews r where r.id=review_id and public.is_workspace_member(r.workspace_id))
);
-- Production: add INSERT-only event policy and enforce reviewer role in a server-side function.
-- Never let browser clients update/delete audit events. Consider append-only triggers.
