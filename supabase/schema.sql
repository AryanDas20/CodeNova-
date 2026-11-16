-- BASE (Brand Governance Platform)
-- Supabase PostgreSQL schema for Firebase Authentication users.
-- Firebase project: base-7bdb4
-- Supabase project ref: egmekbtdurqrpikxfwee
--
-- IMPORTANT:
-- 1. This script is for a NEW/EMPTY BASE database. Do not run it over an existing
--    production schema without a backup and migration review.
-- 2. Firebase users must have the custom JWT claim { "role": "authenticated" }
--    before they can use Supabase Data API tables under these policies.
--    This SQL does NOT assign Firebase custom claims.
-- 3. Never put a Firebase service-account private key or Supabase service_role
--    key in browser JavaScript.

begin;

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Shared helper functions
-- Firebase UID is a TEXT value in JWT claim "sub", not a PostgreSQL UUID.
-- Restrict accepted tokens to this Firebase project.
-- -----------------------------------------------------------------------------

create or replace function public.base_firebase_uid()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when (auth.jwt() ->> 'iss') = 'https://securetoken.google.com/base-7bdb4'
     and (auth.jwt() ->> 'aud') = 'base-7bdb4'
     and (auth.jwt() ->> 'role') = 'authenticated'
    then nullif(auth.jwt() ->> 'sub', '')
    else null
  end;
$$;

-- SECURITY DEFINER helpers avoid recursive RLS evaluation on workspace_members.
create or replace function public.base_is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = public.base_firebase_uid()
  );
$$;

create or replace function public.base_is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspaces w
    where w.id = p_workspace_id
      and w.owner_id = public.base_firebase_uid()
  );
$$;

create or replace function public.base_has_workspace_role(
  p_workspace_id uuid,
  p_allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = public.base_firebase_uid()
      and wm.role = any (p_allowed_roles)
  );
$$;

revoke all on function public.base_firebase_uid() from public, anon;
revoke all on function public.base_is_workspace_member(uuid) from public, anon;
revoke all on function public.base_is_workspace_owner(uuid) from public, anon;
revoke all on function public.base_has_workspace_role(uuid, text[]) from public, anon;
grant execute on function public.base_firebase_uid() to authenticated;
grant execute on function public.base_is_workspace_member(uuid) to authenticated;
grant execute on function public.base_is_workspace_owner(uuid) to authenticated;
grant execute on function public.base_has_workspace_role(uuid, text[]) to authenticated;

-- -----------------------------------------------------------------------------
-- Core tables
-- -----------------------------------------------------------------------------

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  owner_id text not null default public.base_firebase_uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id text not null,
  role text not null default 'viewer'
    check (role in ('owner', 'admin', 'editor', 'reviewer', 'viewer')),
  invited_email text,
  joined_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.brand_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  source_type text not null default 'guideline'
    check (source_type in ('guideline', 'document', 'url', 'note', 'asset')),
  content text,
  source_url text,
  storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_by text not null default public.base_firebase_uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 240),
  content text,
  content_type text not null default 'text'
    check (content_type in ('text', 'image', 'document', 'social_post', 'other')),
  status text not null default 'pending'
    check (status in ('draft', 'pending', 'in_review', 'approved', 'rejected', 'changes_requested')),
  findings jsonb not null default '[]'::jsonb,
  suggestions jsonb not null default '[]'::jsonb,
  submitted_by text not null default public.base_firebase_uid(),
  assigned_to text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Append-only activity records. Client-side inserts are still not authoritative;
-- for high-trust audit events, write them from a trusted server/Edge Function.
create table if not exists public.review_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  review_id uuid references public.reviews(id) on delete set null,
  actor_id text not null default public.base_firebase_uid(),
  event_type text not null check (length(trim(event_type)) between 1 and 80),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.review_comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  review_id uuid not null references public.reviews(id) on delete cascade,
  author_id text not null default public.base_firebase_uid(),
  body text not null check (length(trim(body)) between 1 and 10000),
  created_at timestamptz not null default now()
);

create table if not exists public.review_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  review_id uuid not null references public.reviews(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  content_snapshot text,
  findings_snapshot jsonb not null default '[]'::jsonb,
  changed_by text not null default public.base_firebase_uid(),
  change_note text,
  created_at timestamptz not null default now(),
  unique (review_id, version_number)
);

create index if not exists idx_workspace_members_user on public.workspace_members(user_id);
create index if not exists idx_brand_sources_workspace on public.brand_sources(workspace_id);
create index if not exists idx_reviews_workspace_status on public.reviews(workspace_id, status);
create index if not exists idx_reviews_submitted_by on public.reviews(submitted_by);
create index if not exists idx_review_events_workspace_created on public.review_events(workspace_id, created_at desc);
create index if not exists idx_review_comments_review_created on public.review_comments(review_id, created_at);
create index if not exists idx_review_versions_review_number on public.review_versions(review_id, version_number desc);

-- Keep updated_at current on editable records.
create or replace function public.base_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

 drop trigger if exists trg_workspaces_updated_at on public.workspaces;
create trigger trg_workspaces_updated_at before update on public.workspaces
for each row execute function public.base_set_updated_at();

drop trigger if exists trg_brand_sources_updated_at on public.brand_sources;
create trigger trg_brand_sources_updated_at before update on public.brand_sources
for each row execute function public.base_set_updated_at();

drop trigger if exists trg_reviews_updated_at on public.reviews;
create trigger trg_reviews_updated_at before update on public.reviews
for each row execute function public.base_set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.brand_sources enable row level security;
alter table public.reviews enable row level security;
alter table public.review_events enable row level security;
alter table public.review_comments enable row level security;
alter table public.review_versions enable row level security;

-- Workspaces: a Firebase user can create a workspace for themselves.
drop policy if exists workspaces_select_member on public.workspaces;
create policy workspaces_select_member on public.workspaces
for select to authenticated
using (owner_id = (select public.base_firebase_uid())
       or (select public.base_is_workspace_member(id)));

drop policy if exists workspaces_insert_owner on public.workspaces;
create policy workspaces_insert_owner on public.workspaces
for insert to authenticated
with check (owner_id = (select public.base_firebase_uid()));

drop policy if exists workspaces_update_owner on public.workspaces;
create policy workspaces_update_owner on public.workspaces
for update to authenticated
using (owner_id = (select public.base_firebase_uid()))
with check (owner_id = (select public.base_firebase_uid()));

drop policy if exists workspaces_delete_owner on public.workspaces;
create policy workspaces_delete_owner on public.workspaces
for delete to authenticated
using (owner_id = (select public.base_firebase_uid()));

-- Memberships: only the workspace owner can add/change/remove members.
drop policy if exists workspace_members_select_member on public.workspace_members;
create policy workspace_members_select_member on public.workspace_members
for select to authenticated
using ((select public.base_is_workspace_member(workspace_id))
       or (select public.base_is_workspace_owner(workspace_id)));

drop policy if exists workspace_members_insert_owner on public.workspace_members;
create policy workspace_members_insert_owner on public.workspace_members
for insert to authenticated
with check ((select public.base_is_workspace_owner(workspace_id)));

drop policy if exists workspace_members_update_owner on public.workspace_members;
create policy workspace_members_update_owner on public.workspace_members
for update to authenticated
using ((select public.base_is_workspace_owner(workspace_id)))
with check ((select public.base_is_workspace_owner(workspace_id)));

drop policy if exists workspace_members_delete_owner on public.workspace_members;
create policy workspace_members_delete_owner on public.workspace_members
for delete to authenticated
using ((select public.base_is_workspace_owner(workspace_id)));

-- Brand source library.
drop policy if exists brand_sources_select_member on public.brand_sources;
create policy brand_sources_select_member on public.brand_sources
for select to authenticated
using ((select public.base_is_workspace_member(workspace_id))
       or (select public.base_is_workspace_owner(workspace_id)));

drop policy if exists brand_sources_insert_editor on public.brand_sources;
create policy brand_sources_insert_editor on public.brand_sources
for insert to authenticated
with check (
  created_by = (select public.base_firebase_uid())
  and (select public.base_has_workspace_role(workspace_id, array['owner','admin','editor']))
);

drop policy if exists brand_sources_update_editor on public.brand_sources;
create policy brand_sources_update_editor on public.brand_sources
for update to authenticated
using ((select public.base_has_workspace_role(workspace_id, array['owner','admin','editor'])))
with check ((select public.base_has_workspace_role(workspace_id, array['owner','admin','editor'])));

drop policy if exists brand_sources_delete_editor on public.brand_sources;
create policy brand_sources_delete_editor on public.brand_sources
for delete to authenticated
using ((select public.base_has_workspace_role(workspace_id, array['owner','admin','editor'])));

-- Reviews: workspace members can read; submitters can edit their own;
-- owners/admins/reviewers can edit review records for their workspace.
drop policy if exists reviews_select_member on public.reviews;
create policy reviews_select_member on public.reviews
for select to authenticated
using ((select public.base_is_workspace_member(workspace_id))
       or (select public.base_is_workspace_owner(workspace_id)));

drop policy if exists reviews_insert_member on public.reviews;
create policy reviews_insert_member on public.reviews
for insert to authenticated
with check (
  submitted_by = (select public.base_firebase_uid())
  and ((select public.base_is_workspace_member(workspace_id))
       or (select public.base_is_workspace_owner(workspace_id)))
);

drop policy if exists reviews_update_submitter_or_reviewer on public.reviews;
create policy reviews_update_submitter_or_reviewer on public.reviews
for update to authenticated
using (
  submitted_by = (select public.base_firebase_uid())
  or (select public.base_has_workspace_role(workspace_id, array['owner','admin','reviewer']))
)
with check (
  (select public.base_is_workspace_member(workspace_id))
  or (select public.base_is_workspace_owner(workspace_id))
);

drop policy if exists reviews_delete_submitter_or_admin on public.reviews;
create policy reviews_delete_submitter_or_admin on public.reviews
for delete to authenticated
using (
  submitted_by = (select public.base_firebase_uid())
  or (select public.base_has_workspace_role(workspace_id, array['owner','admin']))
);

-- Activity history: readable by workspace members, insert-only for clients.
drop policy if exists review_events_select_member on public.review_events;
create policy review_events_select_member on public.review_events
for select to authenticated
using ((select public.base_is_workspace_member(workspace_id))
       or (select public.base_is_workspace_owner(workspace_id)));

drop policy if exists review_events_insert_member on public.review_events;
create policy review_events_insert_member on public.review_events
for insert to authenticated
with check (
  actor_id = (select public.base_firebase_uid())
  and ((select public.base_is_workspace_member(workspace_id))
       or (select public.base_is_workspace_owner(workspace_id)))
);

-- No UPDATE or DELETE policy is intentionally created for review_events.

-- Comments: members can read; users can add comments as themselves.
drop policy if exists review_comments_select_member on public.review_comments;
create policy review_comments_select_member on public.review_comments
for select to authenticated
using ((select public.base_is_workspace_member(workspace_id))
       or (select public.base_is_workspace_owner(workspace_id)));

drop policy if exists review_comments_insert_member on public.review_comments;
create policy review_comments_insert_member on public.review_comments
for insert to authenticated
with check (
  author_id = (select public.base_firebase_uid())
  and ((select public.base_is_workspace_member(workspace_id))
       or (select public.base_is_workspace_owner(workspace_id)))
);

-- No UPDATE or DELETE policy is intentionally created for comments.

-- Revision snapshots: members can read and create; snapshots cannot be edited/deleted.
drop policy if exists review_versions_select_member on public.review_versions;
create policy review_versions_select_member on public.review_versions
for select to authenticated
using ((select public.base_is_workspace_member(workspace_id))
       or (select public.base_is_workspace_owner(workspace_id)));

drop policy if exists review_versions_insert_member on public.review_versions;
create policy review_versions_insert_member on public.review_versions
for insert to authenticated
with check (
  changed_by = (select public.base_firebase_uid())
  and ((select public.base_is_workspace_member(workspace_id))
       or (select public.base_is_workspace_owner(workspace_id)))
);

-- Explicit table privileges; RLS remains the row-level security boundary.
grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;
grant select, insert, update, delete on public.brand_sources to authenticated;
grant select, insert, update, delete on public.reviews to authenticated;
grant select, insert on public.review_events to authenticated;
grant select, insert on public.review_comments to authenticated;
grant select, insert on public.review_versions to authenticated;

commit;

-- After creating the first workspace, add its owner as a member using the same
-- Firebase UID. Example (replace the placeholders; run while authenticated in
-- your app, not as an unauthenticated SQL Editor query):
-- insert into public.workspace_members (workspace_id, user_id, role)
-- values ('WORKSPACE_UUID', 'FIREBASE_UID', 'owner');
