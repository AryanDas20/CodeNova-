-- BASE / CodeNova: additive compatibility migration for the current Supabase Auth app.
-- This script is designed for the existing schema described in the project setup:
--   brand_sources: title/content/created_by (text identity)
--   reviews: submitted_by (text identity)
--   review_events: actor_id (text identity)
--   review_comments: author_id (text identity)
--   workspace_members.user_id and workspaces.created_by: UUID (Supabase Auth)
--
-- IMPORTANT:
-- * No user-identity column is cast from text to UUID.
-- * No existing table is dropped.
-- * Legacy columns and rows are retained.
-- * App-facing columns are added and backfilled where possible.
-- Run the whole file in Supabase SQL Editor.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Core workspace tables
-- ---------------------------------------------------------------------------
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  owner_id text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspaces add column if not exists owner_id text;
alter table public.workspaces add column if not exists created_by uuid;
alter table public.workspaces add column if not exists updated_at timestamptz not null default now();

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer'
    check (role in ('creator', 'brand_owner', 'reviewer', 'admin', 'viewer')),
  invited_email text,
  joined_at timestamptz not null default now()
);

alter table public.workspace_members add column if not exists id uuid default gen_random_uuid();
alter table public.workspace_members add column if not exists invited_email text;
alter table public.workspace_members add column if not exists joined_at timestamptz not null default now();

-- The existing project already stores workspace_members.user_id and
-- workspaces.created_by as UUIDs. Do not alter either type or cast text IDs.
create unique index if not exists workspace_members_workspace_user_unique
  on public.workspace_members(workspace_id, user_id);
create index if not exists workspace_members_user_idx
  on public.workspace_members(user_id);

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(username) between 2 and 32),
  avatar_url text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Brand sources: retain old title/content/created_by fields and add app fields.
-- Identity values remain text because the existing prototype used text IDs.
-- ---------------------------------------------------------------------------
create table if not exists public.brand_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text,
  content text,
  created_by text,
  name text,
  source_type text not null default 'guideline',
  body text,
  owner_id text,
  version text not null default 'v1.0',
  review_due date,
  source_url text,
  storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.brand_sources add column if not exists name text;
alter table public.brand_sources add column if not exists body text;
alter table public.brand_sources add column if not exists owner_id text;
alter table public.brand_sources add column if not exists version text default 'v1.0';
alter table public.brand_sources add column if not exists review_due date;
alter table public.brand_sources add column if not exists updated_at timestamptz not null default now();

update public.brand_sources
set name = coalesce(nullif(name, ''), nullif(title, ''), 'Untitled source'),
    body = coalesce(body, content),
    owner_id = coalesce(owner_id, created_by)
where name is null or name = '' or body is null or owner_id is null;

alter table public.brand_sources alter column name set not null;
alter table public.brand_sources alter column owner_id set not null;

-- ---------------------------------------------------------------------------
-- Reviews: retain submitted_by/content_type and add the app's owner_uid/channel.
-- Do not cast submitted_by to UUID.
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  content text,
  content_type text not null default 'text',
  submitted_by text,
  owner_uid text,
  channel text,
  status text not null default 'Needs review',
  findings jsonb not null default '[]'::jsonb,
  suggestions jsonb not null default '[]'::jsonb,
  brand_pack_version text,
  assigned_to text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reviews add column if not exists owner_uid text;
alter table public.reviews add column if not exists channel text;
alter table public.reviews add column if not exists suggestions jsonb not null default '[]'::jsonb;
alter table public.reviews add column if not exists brand_pack_version text;
alter table public.reviews add column if not exists updated_at timestamptz not null default now();

update public.reviews
set owner_uid = coalesce(owner_uid, submitted_by)
where owner_uid is null;

alter table public.reviews alter column owner_uid set not null;
alter table public.reviews alter column status set default 'Needs review';
alter table public.reviews alter column findings set default '[]'::jsonb;

-- Remove legacy status CHECK constraints only; the RPC below validates the
-- supported status values. This avoids rejecting the old 'pending' value.
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.reviews'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.reviews drop constraint %I', c.conname);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Review events: add actor_uid while retaining legacy actor_id.
-- ---------------------------------------------------------------------------
create table if not exists public.review_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  review_id uuid references public.reviews(id) on delete set null,
  actor_id text,
  actor_uid text,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.review_events add column if not exists workspace_id uuid;
alter table public.review_events add column if not exists actor_uid text;
alter table public.review_events alter column review_id drop not null;

update public.review_events
set actor_uid = coalesce(actor_uid, actor_id)
where actor_uid is null;

alter table public.review_events alter column actor_uid set not null;

-- Backfill workspace_id from the linked review only when it is missing.
update public.review_events e
set workspace_id = r.workspace_id
from public.reviews r
where e.review_id = r.id and e.workspace_id is null;

-- ---------------------------------------------------------------------------
-- Review comments: add UUID user_id for new app writes, retain legacy author_id.
-- Existing author_id values are not force-cast; only valid Auth UUIDs are mapped.
-- ---------------------------------------------------------------------------
create table if not exists public.review_comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  review_id uuid not null references public.reviews(id) on delete cascade,
  author_id text,
  user_id uuid,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

alter table public.review_comments add column if not exists user_id uuid;

update public.review_comments
set user_id = case
  when author_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then author_id::uuid
  else null
end
where user_id is null and author_id is not null;

-- ---------------------------------------------------------------------------
-- Review versions and invitations
-- ---------------------------------------------------------------------------
create table if not exists public.review_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  review_id uuid not null references public.reviews(id) on delete cascade,
  version_number integer not null,
  content_snapshot text,
  findings_snapshot jsonb not null default '[]'::jsonb,
  changed_by text not null,
  change_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invited_email text not null,
  role text not null check (role in ('creator', 'reviewer', 'brand_owner')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create unique index if not exists workspace_invites_pending_email
  on public.workspace_invitations(workspace_id, lower(invited_email))
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists brand_sources_workspace_idx
  on public.brand_sources(workspace_id, created_at desc);
create index if not exists reviews_workspace_idx
  on public.reviews(workspace_id, updated_at desc);
create index if not exists review_events_workspace_idx
  on public.review_events(workspace_id, created_at desc);
create index if not exists review_comments_review_idx
  on public.review_comments(review_id, created_at);
create index if not exists review_versions_review_idx
  on public.review_versions(review_id, version_number desc);

-- ---------------------------------------------------------------------------
-- Updated-at trigger
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workspaces_touch_updated_at on public.workspaces;
create trigger workspaces_touch_updated_at before update on public.workspaces
for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists brand_sources_touch_updated_at on public.brand_sources;
create trigger brand_sources_touch_updated_at before update on public.brand_sources
for each row execute function public.touch_updated_at();

drop trigger if exists reviews_touch_updated_at on public.reviews;
create trigger reviews_touch_updated_at before update on public.reviews
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Auth profile bootstrap
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
begin
  display_name := coalesce(
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'full_name',
    split_part(coalesce(new.email, ''), '@', 1),
    'New member'
  );
  if char_length(display_name) < 2 then display_name := 'New member'; end if;

  insert into public.profiles(user_id, username)
  values (new.id, left(display_name, 32))
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Security helpers. Workspace membership uses Supabase Auth UUIDs.
-- ---------------------------------------------------------------------------
create or replace function public.is_workspace_member(wid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = wid and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin(wid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = wid and m.user_id = auth.uid() and m.role = 'admin'
  );
$$;

create or replace function public.is_workspace_source_manager(wid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = wid
      and m.user_id = auth.uid()
      and m.role in ('brand_owner', 'admin')
  );
$$;

create or replace function public.is_workspace_reviewer(wid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = wid
      and m.user_id = auth.uid()
      and m.role in ('reviewer', 'brand_owner', 'admin')
  );
$$;

create or replace function public.is_workspace_colleague(other_user uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members mine
    join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = auth.uid() and theirs.user_id = other_user
  );
$$;

-- ---------------------------------------------------------------------------
-- Workspace creation and invitation acceptance
-- ---------------------------------------------------------------------------
create or replace function public.create_workspace(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  if p_name is null or char_length(trim(p_name)) < 2 or char_length(trim(p_name)) > 80 then
    raise exception 'Workspace name must be 2 to 80 characters';
  end if;

  insert into public.workspaces(name, owner_id, created_by)
  values (trim(p_name), auth.uid()::text, auth.uid())
  returning id into new_workspace_id;

  insert into public.workspace_members(workspace_id, user_id, role)
  values (new_workspace_id, auth.uid(), 'admin');

  return new_workspace_id;
end;
$$;

create or replace function public.accept_pending_workspace_invitations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  accepted_count integer;
  user_email text;
begin
  if auth.uid() is null then return 0; end if;
  user_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if user_email = '' then return 0; end if;

  insert into public.workspace_members(workspace_id, user_id, role)
  select i.workspace_id, auth.uid(), i.role
  from public.workspace_invitations i
  where lower(i.invited_email) = user_email and i.status = 'pending'
  on conflict (workspace_id, user_id) do nothing;

  update public.workspace_invitations
  set status = 'accepted', accepted_at = now()
  where lower(invited_email) = user_email and status = 'pending';

  get diagnostics accepted_count = row_count;
  return accepted_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Review status RPC. Ownership comparison uses text UUIDs, not a type cast.
-- ---------------------------------------------------------------------------
create or replace function public.set_review_status(p_review_id uuid, p_status text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  review_row public.reviews%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  if p_status is null or p_status not in
    ('Needs review', 'In progress', 'Changes requested', 'Approved', 'On hold') then
    raise exception 'Invalid review status';
  end if;

  select * into review_row
  from public.reviews
  where id = p_review_id;

  if not found or not public.is_workspace_member(review_row.workspace_id) then
    raise exception 'Review not found or access denied';
  end if;

  if not public.is_workspace_reviewer(review_row.workspace_id) then
    raise exception 'Reviewer permission is required';
  end if;

  if p_status = 'Approved' and review_row.owner_uid = auth.uid()::text then
    raise exception 'A creator cannot approve their own submission';
  end if;

  update public.reviews
  set status = p_status
  where id = p_review_id;

  insert into public.review_events(
    workspace_id, review_id, actor_id, actor_uid, event_type, details
  )
  values (
    review_row.workspace_id,
    review_row.id,
    auth.uid()::text,
    auth.uid()::text,
    'review_decision',
    jsonb_build_object('title', review_row.title, 'status', p_status)
  );

  return p_review_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS. Remove previous policies so old permissive policies cannot OR-bypass.
-- ---------------------------------------------------------------------------
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.profiles enable row level security;
alter table public.brand_sources enable row level security;
alter table public.reviews enable row level security;
alter table public.review_events enable row level security;
alter table public.review_comments enable row level security;
alter table public.review_versions enable row level security;
alter table public.workspace_invitations enable row level security;

do $$
declare policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'workspaces', 'workspace_members', 'profiles', 'brand_sources',
        'reviews', 'review_events', 'review_comments', 'review_versions',
        'workspace_invitations'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_row.policyname, policy_row.schemaname, policy_row.tablename
    );
  end loop;
end;
$$;

create policy workspaces_select_member on public.workspaces
for select to authenticated
using (public.is_workspace_member(id));

create policy workspaces_update_admin on public.workspaces
for update to authenticated
using (public.is_workspace_admin(id))
with check (public.is_workspace_admin(id));

create policy members_select_workspace on public.workspace_members
for select to authenticated
using (user_id = auth.uid() or public.is_workspace_member(workspace_id));

create policy profiles_select_colleague on public.profiles
for select to authenticated
using (user_id = auth.uid() or public.is_workspace_colleague(user_id));

create policy profiles_insert_self on public.profiles
for insert to authenticated
with check (user_id = auth.uid());

create policy profiles_update_self on public.profiles
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy sources_select_member on public.brand_sources
for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy sources_insert_manager on public.brand_sources
for insert to authenticated
with check (
  owner_id = auth.uid()::text
  and public.is_workspace_source_manager(workspace_id)
);

create policy sources_update_manager on public.brand_sources
for update to authenticated
using (public.is_workspace_source_manager(workspace_id))
with check (public.is_workspace_source_manager(workspace_id));

create policy sources_delete_manager on public.brand_sources
for delete to authenticated
using (public.is_workspace_source_manager(workspace_id));

create policy reviews_select_member on public.reviews
for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy reviews_insert_member on public.reviews
for insert to authenticated
with check (
  owner_uid = auth.uid()::text
  and public.is_workspace_member(workspace_id)
);

create policy reviews_update_owner on public.reviews
for update to authenticated
using (
  (owner_uid = auth.uid()::text or public.is_workspace_admin(workspace_id))
  and public.is_workspace_member(workspace_id)
)
with check (
  (owner_uid = auth.uid()::text or public.is_workspace_admin(workspace_id))
  and public.is_workspace_member(workspace_id)
);

create policy reviews_delete_owner_or_admin on public.reviews
for delete to authenticated
using (
  public.is_workspace_member(workspace_id)
  and (
    owner_uid = auth.uid()::text
    or public.is_workspace_admin(workspace_id)
  )
);

create policy events_select_member on public.review_events
for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy events_insert_member on public.review_events
for insert to authenticated
with check (
  actor_uid = auth.uid()::text
  and public.is_workspace_member(workspace_id)
);

create policy comments_select_member on public.review_comments
for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy comments_insert_member on public.review_comments
for insert to authenticated
with check (
  user_id = auth.uid()
  and public.is_workspace_member(workspace_id)
  and exists (
    select 1
    from public.reviews r
    where r.id = review_id and r.workspace_id = review_comments.workspace_id
  )
);

create policy versions_select_member on public.review_versions
for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy versions_insert_reviewer on public.review_versions
for insert to authenticated
with check (
  changed_by = auth.uid()::text
  and public.is_workspace_reviewer(workspace_id)
);

create policy invitations_select_admin on public.workspace_invitations
for select to authenticated
using (public.is_workspace_admin(workspace_id));

-- ---------------------------------------------------------------------------
-- Column-level permissions: statuses are changed only through the RPC.
-- ---------------------------------------------------------------------------
revoke update on public.workspaces from authenticated;
grant update (name) on public.workspaces to authenticated;

revoke update on public.brand_sources from authenticated;
grant update (name, source_type, body, version, review_due) on public.brand_sources to authenticated;

revoke update on public.reviews from authenticated;
grant update (title, channel, content) on public.reviews to authenticated;

-- Function execution permissions
revoke all on function public.is_workspace_member(uuid) from public, anon;
revoke all on function public.is_workspace_admin(uuid) from public, anon;
revoke all on function public.is_workspace_source_manager(uuid) from public, anon;
revoke all on function public.is_workspace_reviewer(uuid) from public, anon;
revoke all on function public.is_workspace_colleague(uuid) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;
grant execute on function public.is_workspace_source_manager(uuid) to authenticated;
grant execute on function public.is_workspace_reviewer(uuid) to authenticated;
grant execute on function public.is_workspace_colleague(uuid) to authenticated;

revoke all on function public.create_workspace(text) from public, anon;
revoke all on function public.accept_pending_workspace_invitations() from public, anon;
revoke all on function public.set_review_status(uuid, text) from public, anon;
grant execute on function public.create_workspace(text) to authenticated;
grant execute on function public.accept_pending_workspace_invitations() to authenticated;
grant execute on function public.set_review_status(uuid, text) to authenticated;

commit;

-- After running this script, verify the app-facing columns with:
-- select table_name, column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public'
--   and (table_name, column_name) in (
--     ('brand_sources','name'), ('brand_sources','body'), ('brand_sources','owner_id'),
--     ('reviews','owner_uid'), ('reviews','channel'),
--     ('review_events','actor_uid'), ('review_comments','user_id')
--   )
-- order by table_name, column_name;
