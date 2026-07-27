-- ============================================================
-- Aligned — Migration 003
-- Clients: + assigned Manager + login credentials
--
-- Two additions beyond the original design:
--
-- 1. manager_id — every client is assigned exactly one NuAIg
--    Manager (validated by the trigger from migration 002 — must
--    be admin/manager). This is the routing key for ticket
--    visibility/assignment in migration 010.
--
-- 2. login_id / password_hash — clients now authenticate with a
--    real credential instead of an unguessable portal_token in a
--    URL. This is deliberately ONE shared login per client company,
--    not per contact — individual attribution on tickets/comments
--    happens via a "posting as" name picked from client_contacts,
--    not via separate credentials. Nullable until the team issues
--    credentials from the dashboard.
-- ============================================================

create table if not exists clients (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  slug                 text not null unique,
  manager_id           uuid references team_members(id) on delete set null,

  login_id             text unique,
  password_hash        text,
  must_change_password boolean not null default true,
  last_login_at        timestamptz,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_clients_manager  on clients(manager_id);
create index if not exists idx_clients_login_id on clients(login_id);

drop trigger if exists clients_updated_at on clients;
create trigger clients_updated_at
  before update on clients
  for each row execute function handle_updated_at();

-- Reuses is_admin_or_manager() from migration 002 — the same rule,
-- never a second copy of it.
create or replace function validate_client_manager()
returns trigger language plpgsql as $$
begin
  if new.manager_id is not null and not is_admin_or_manager(new.manager_id) then
    raise exception 'clients.manager_id % must reference a team member with role admin or manager', new.manager_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_clients_validate_manager on clients;
create trigger trg_clients_validate_manager
  before insert or update of manager_id on clients
  for each row execute function validate_client_manager();
