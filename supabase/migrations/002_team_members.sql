-- ============================================================
-- Aligned — Migration 002
-- Team members: roles + manager hierarchy
--
-- Three explicit tiers, borrowed from Chronos's profiles model:
--   admin   — unrestricted, sees/manages everything
--   manager — owns a set of clients (clients.manager_id) and a
--             set of reports (team_members.manager_id)
--   member  — scoped to their manager's clients (see the ticket
--             RLS in migration 010)
--
-- Unlike the old schema, role is a real enum (was an unchecked
-- free-text column defaulting to 'member' with nothing stopping
-- a typo from silently granting/denying access).
-- ============================================================

do $$ begin
  create type team_role as enum ('admin', 'manager', 'member');
exception when duplicate_object then null;
end $$;

create table if not exists team_members (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  email       text not null unique,
  role        team_role not null default 'member',
  manager_id  uuid references team_members(id) on delete set null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint team_members_not_own_manager check (manager_id is null or manager_id <> id)
);

create index if not exists idx_team_members_manager on team_members(manager_id);
create index if not exists idx_team_members_role    on team_members(role);

drop trigger if exists team_members_updated_at on team_members;
create trigger team_members_updated_at
  before update on team_members
  for each row execute function handle_updated_at();

-- ============================================================
-- A manager (team_members.manager_id, and later clients.manager_id)
-- must actually hold the admin or manager role. Enforced by trigger
-- rather than a CHECK constraint since it requires a cross-row
-- lookup — reused by the clients table in migration 003.
-- ============================================================
create or replace function is_admin_or_manager(p_team_member_id uuid)
returns boolean language sql security definer stable as $$
  select coalesce(
    (select role in ('admin', 'manager') from team_members where id = p_team_member_id),
    false
  );
$$;

create or replace function validate_team_member_manager()
returns trigger language plpgsql as $$
begin
  if new.manager_id is not null and not is_admin_or_manager(new.manager_id) then
    raise exception 'manager_id % must reference a team member with role admin or manager', new.manager_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_team_members_validate_manager on team_members;
create trigger trg_team_members_validate_manager
  before insert or update of manager_id on team_members
  for each row execute function validate_team_member_manager();

-- ============================================================
-- Auto-insert a team_members row whenever someone signs up via
-- Supabase Auth. Always starts as 'member' — promote to admin/
-- manager manually afterwards (see CLAUDE.md bootstrap steps).
-- ============================================================
create or replace function handle_new_auth_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.team_members (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    'member'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();
