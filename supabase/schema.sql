-- BASE: secure Supabase schema + migration from the original starter schema.
-- Run this entire script in Supabase SQL Editor. It creates no demo/sample records.

create extension if not exists pgcrypto;

-- Core workspace boundary.
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('creator', 'brand_owner', 'reviewer', 'admin')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- Upgrade fields when running against the original BASE prototype schema.
alter table public.workspaces add column if not exists updated_at timestamptz not null default now();
alter table public.workspace_members add column if not exists joined_at timestamptz not null default now();

-- Compatibility repair for the earlier BASE prototype schema.
-- The prototype used workspace_members.user_id as text and workspaces.owner_id as text.
-- The application and all auth/RLS helpers use Supabase Auth UUIDs.
-- Give legacy Firebase/non-UUID identity rows a clear stop instead of a raw cast error.
do $$
begin
  if exists (
    select 1 from public.workspace_members
    where nullif(btrim(user_id::text), '') is null
       or btrim(user_id::text) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) then
    raise exception 'Cannot migrate workspace_members.user_id: one or more rows are not Supabase Auth UUIDs. Re-link those legacy members to matching auth.users UUIDs before rerunning this script; no memberships were deleted.';
  end if;
end;
$$;

alter table public.workspace_members
  alter column user_id type uuid
  using nullif(btrim(user_id::text), '')::uuid;

-- Stop with a clear message if old IDs are UUID-shaped but are not Supabase Auth users.
do $$
begin
  if exists (
    select 1 from public.workspace_members m
    where not exists (select 1 from auth.users u where u.id = m.user_id)
  ) then
    raise exception 'Cannot migrate workspace_members.user_id: one or more UUIDs do not exist in auth.users. Sign those people into this Supabase project or map their memberships to valid Auth UUIDs before rerunning.';
  end if;
  if exists (
    select 1 from public.workspace_members
    where role is null or role not in ('creator', 'brand_owner', 'reviewer', 'admin')
  ) then
    raise exception 'Cannot migrate workspace_members.role: one or more roles are unsupported. Map roles to creator, brand_owner, reviewer or admin before rerunning.';
  end if;
end;
$$;

-- The old workspace table used owner_id; the current app/schema uses created_by.
alter table public.workspaces add column if not exists created_by uuid;

-- Preserve legacy ownership where owner_id contains a real Supabase Auth UUID.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'workspaces'
      and column_name = 'owner_id' and data_type in ('text', 'character varying')
  ) then
    execute $q$
      update public.workspaces w
      set created_by = w.owner_id::uuid
      where w.created_by is null
        and w.owner_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and exists (select 1 from auth.users u where u.id = w.owner_id::uuid)
    $q$;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'workspaces'
      and column_name = 'owner_id' and data_type = 'uuid'
  ) then
    execute $q$
      update public.workspaces w
      set created_by = w.owner_id
      where w.created_by is null
        and exists (select 1 from auth.users u where u.id = w.owner_id)
    $q$;
  end if;
end;
$$;

-- Do not silently invent owners for pre-existing workspaces.
do $$
begin
  if exists (
    select 1 from public.workspaces w
    where w.created_by is null
       or not exists (select 1 from auth.users u where u.id = w.created_by)
  ) then
    raise exception 'Some workspaces have no valid created_by Auth UUID in auth.users. Map their owners before applying this schema; existing workspace data has not been deleted.';
  end if;
end;
$$;

alter table public.workspaces alter column created_by set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.conrelid = 'public.workspaces'::regclass
      and c.confrelid = 'auth.users'::regclass
      and c.contype = 'f'
      and a.attname = 'created_by'
  ) then
    alter table public.workspaces
      add constraint workspaces_created_by_auth_fkey
      foreign key (created_by) references auth.users(id) on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.conrelid = 'public.workspace_members'::regclass
      and c.confrelid = 'auth.users'::regclass
      and c.contype = 'f'
      and a.attname = 'user_id'
  ) then
    alter table public.workspace_members
      add constraint workspace_members_user_auth_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end;
$$;

-- Supports ON CONFLICT (workspace_id, user_id) even on the old table,
-- which had a separate surrogate id primary key.
create unique index if not exists workspace_members_workspace_user_unique
  on public.workspace_members (workspace_id, user_id);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(username) between 2 and 32),
  avatar_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.brand_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  source_type text not null,
  body text not null,
  version text not null default 'v1.0',
  owner_id uuid not null references auth.users(id) on delete restrict,
  review_due date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.brand_sources add column if not exists review_due date;
alter table public.brand_sources add column if not exists updated_at timestamptz not null default now();

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_uid uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(title) between 2 and 160),
  channel text,
  content text not null,
  status text not null default 'Needs review' check (status in ('Needs review', 'In progress', 'Changes requested', 'Approved', 'On hold')),
  findings jsonb not null default '[]'::jsonb,
  brand_pack_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.reviews add column if not exists updated_at timestamptz not null default now();
alter table public.reviews alter column findings set default '[]'::jsonb;

-- Audit events are append-only from authenticated clients. A NULL review_id is allowed
-- for workspace-level events such as profile changes, invitations and source additions.
create table if not exists public.review_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  review_id uuid references public.reviews(id) on delete set null,
  actor_uid uuid not null references auth.users(id) on delete restrict,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.review_events add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.review_events alter column review_id drop not null;
alter table public.review_events drop constraint if exists review_events_review_id_fkey;
alter table public.review_events add constraint review_events_review_id_fkey
  foreign key (review_id) references public.reviews(id) on delete set null;
update public.review_events e
set workspace_id = r.workspace_id
from public.reviews r
where e.review_id = r.id and e.workspace_id is null;

create table if not exists public.review_comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invited_email text not null,
  role text not null check (role in ('creator', 'reviewer', 'brand_owner')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create unique index if not exists workspace_invites_pending_email
  on public.workspace_invitations (workspace_id, lower(invited_email)) where status = 'pending';

create index if not exists workspace_members_user_idx on public.workspace_members(user_id);
create index if not exists brand_sources_workspace_idx on public.brand_sources(workspace_id, created_at desc);
create index if not exists reviews_workspace_idx on public.reviews(workspace_id, updated_at desc);
create index if not exists review_events_workspace_idx on public.review_events(workspace_id, created_at desc);
create index if not exists review_comments_review_idx on public.review_comments(review_id, created_at);

-- Updated-at helper.
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public
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

-- Auth profile bootstrap. The browser also performs an idempotent upsert for older accounts.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  display_name text;
begin
  display_name := coalesce(new.raw_user_meta_data ->> 'username', new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), 'New member');
  if char_length(display_name) < 2 then display_name := 'New member'; end if;
  insert into public.profiles(user_id, username)
  values (new.id, left(display_name, 32))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users for each row execute function public.handle_new_auth_user();

-- Security-definer helpers prevent RLS recursion while checking membership.
create or replace function public.is_workspace_member(wid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = wid and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin(wid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = wid and m.user_id = auth.uid() and m.role = 'admin'
  );
$$;

create or replace function public.is_workspace_source_manager(wid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = wid and m.user_id = auth.uid() and m.role in ('brand_owner', 'admin')
  );
$$;

create or replace function public.is_workspace_reviewer(wid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = wid and m.user_id = auth.uid() and m.role in ('reviewer', 'brand_owner', 'admin')
  );
$$;

create or replace function public.is_workspace_colleague(other_user uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members mine
    join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = auth.uid() and theirs.user_id = other_user
  );
$$;

-- Create the first workspace and its administrator membership atomically.
create or replace function public.create_workspace(p_name text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  new_workspace_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  if p_name is null or char_length(trim(p_name)) < 2 or char_length(trim(p_name)) > 80 then
    raise exception 'Workspace name must be 2 to 80 characters';
  end if;
  insert into public.workspaces(name, created_by)
  values (trim(p_name), auth.uid())
  returning id into new_workspace_id;
  insert into public.workspace_members(workspace_id, user_id, role)
  values (new_workspace_id, auth.uid(), 'admin');
  return new_workspace_id;
end;
$$;

-- Accept workspace invitations after the invited user signs in with the invited email.
create or replace function public.accept_pending_workspace_invitations()
returns integer language plpgsql security definer set search_path = public
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

-- Review decisions are recorded through this RPC, not by arbitrary status updates.
create or replace function public.set_review_status(p_review_id uuid, p_status text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  review_row public.reviews%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  if p_status not in ('Needs review', 'In progress', 'Changes requested', 'Approved', 'On hold') then
    raise exception 'Invalid review status';
  end if;
  select * into review_row from public.reviews where id = p_review_id;
  if not found or not public.is_workspace_member(review_row.workspace_id) then
    raise exception 'Review not found or access denied';
  end if;
  if not public.is_workspace_reviewer(review_row.workspace_id) then
    raise exception 'Reviewer permission is required';
  end if;
  if p_status = 'Approved' and review_row.owner_uid = auth.uid() then
    raise exception 'A creator cannot approve their own submission';
  end if;
  update public.reviews set status = p_status where id = p_review_id;
  insert into public.review_events(workspace_id, review_id, actor_uid, event_type, details)
  values (review_row.workspace_id, review_row.id, auth.uid(), 'review_decision', jsonb_build_object('title', review_row.title, 'status', p_status));
  return p_review_id;
end;
$$;

-- Row-level security.
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.profiles enable row level security;
alter table public.brand_sources enable row level security;
alter table public.reviews enable row level security;
alter table public.review_events enable row level security;
alter table public.review_comments enable row level security;
alter table public.workspace_invitations enable row level security;

-- Remove every pre-existing policy on these tables, including policies from older iterations
-- with names not known to this migration. Leaving an old permissive policy would bypass the
-- intended RLS boundary because PostgreSQL combines permissive policies with OR.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('workspaces', 'workspace_members', 'profiles', 'brand_sources', 'reviews', 'review_events', 'review_comments', 'workspace_invitations')
  loop
    execute format('drop policy if exists %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end;
$$;

create policy workspaces_select_member on public.workspaces
for select to authenticated using (public.is_workspace_member(id));
create policy workspaces_update_admin on public.workspaces
for update to authenticated using (public.is_workspace_admin(id)) with check (public.is_workspace_admin(id));

create policy members_select_workspace on public.workspace_members
for select to authenticated using (user_id = auth.uid() or public.is_workspace_member(workspace_id));

create policy profiles_select_colleague on public.profiles
for select to authenticated using (user_id = auth.uid() or public.is_workspace_colleague(user_id));
create policy profiles_insert_self on public.profiles
for insert to authenticated with check (user_id = auth.uid());
create policy profiles_update_self on public.profiles
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy sources_select_member on public.brand_sources
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy sources_insert_manager on public.brand_sources
for insert to authenticated with check (owner_id = auth.uid() and public.is_workspace_source_manager(workspace_id));
create policy sources_update_manager on public.brand_sources
for update to authenticated using (public.is_workspace_source_manager(workspace_id)) with check (public.is_workspace_source_manager(workspace_id));
create policy sources_delete_manager on public.brand_sources
for delete to authenticated using (public.is_workspace_source_manager(workspace_id));

create policy reviews_select_member on public.reviews
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy reviews_insert_member on public.reviews
for insert to authenticated with check (owner_uid = auth.uid() and public.is_workspace_member(workspace_id));
create policy reviews_update_owner on public.reviews
for update to authenticated using (owner_uid = auth.uid() and public.is_workspace_member(workspace_id)) with check (owner_uid = auth.uid() and public.is_workspace_member(workspace_id));
create policy reviews_delete_owner_or_admin on public.reviews
for delete to authenticated using (public.is_workspace_member(workspace_id) and (owner_uid = auth.uid() or public.is_workspace_admin(workspace_id)));

create policy events_select_member on public.review_events
for select to authenticated using (
  public.is_workspace_member(workspace_id)
  and (review_id is null or exists (
    select 1 from public.reviews r where r.id = review_id and r.workspace_id = review_events.workspace_id
  ))
);
create policy events_insert_member on public.review_events
for insert to authenticated with check (
  actor_uid = auth.uid() and public.is_workspace_member(workspace_id)
  and (review_id is null or exists (
    select 1 from public.reviews r where r.id = review_id and r.workspace_id = review_events.workspace_id
  ))
);

create policy comments_select_member on public.review_comments
for select to authenticated using (
  public.is_workspace_member(workspace_id)
  and exists (select 1 from public.reviews r where r.id = review_id and r.workspace_id = review_comments.workspace_id)
);
create policy comments_insert_member on public.review_comments
for insert to authenticated with check (
  user_id = auth.uid() and public.is_workspace_member(workspace_id)
  and exists (select 1 from public.reviews r where r.id = review_id and r.workspace_id = review_comments.workspace_id)
);

create policy invitations_select_admin on public.workspace_invitations
for select to authenticated using (public.is_workspace_admin(workspace_id));

-- Restrict mutable columns so a workspace admin cannot rewrite its owner/ID and
-- a source manager cannot move a source between tenants or impersonate its owner.
revoke update on public.workspaces from authenticated;
grant update (name) on public.workspaces to authenticated;
revoke update on public.brand_sources from authenticated;
grant update (name, source_type, body, version, review_due) on public.brand_sources to authenticated;

-- Prevent browser clients from editing review status directly; the set_review_status RPC
-- enforces reviewer rights and separation of duties.
revoke update on public.reviews from authenticated;
grant update (title, channel, content) on public.reviews to authenticated;
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

-- Review-event records have no UPDATE or DELETE policies by design.
-- Invitation inserts are performed by the trusted Edge Function with the service-role key.
-- Never place the service-role key or AI provider key in config.js / browser assets.
