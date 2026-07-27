-- ============================================================
-- Aligned — Migration 004
-- Client contacts
--
-- Contacts exist at client level (project_id null, inherited by
-- every project) or project level (project_id set, additions for
-- one specific project). Unchanged from the original design.
--
-- These rows now do double duty: they're also the source list for
-- the "posting as" name a client picks when raising a ticket or
-- commenting under the shared client login (see migration 006+).
--
-- project_id's FK is added in migration 005, once projects exists.
-- ============================================================

create table if not exists client_contacts (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  project_id  uuid,
  name        text not null,
  email       text not null,
  is_active   boolean not null default true,
  removed_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_contacts_client  on client_contacts(client_id);
create index if not exists idx_contacts_project on client_contacts(project_id);

drop trigger if exists contacts_updated_at on client_contacts;
create trigger contacts_updated_at
  before update on client_contacts
  for each row execute function handle_updated_at();
