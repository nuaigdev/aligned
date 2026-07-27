-- ============================================================
-- Aligned — Migration 005
-- Projects
--
-- Deliberately NO portal_token column. The old design reached the
-- client portal via an unguessable per-project token URL; that's
-- retired in favour of session-based client login (migration 003 +
-- the app's /portal/login) which covers milestones/decisions/
-- documents/tickets uniformly, so there's no token to generate here
-- at all — not even as a deprecated leftover column.
-- ============================================================

do $$ begin
  create type project_status as enum (
    'active',
    'on_hold',
    'awaiting_client',
    'awaiting_team',
    'completed',
    'archived'
  );
exception when duplicate_object then null;
end $$;

create table if not exists projects (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id) on delete cascade,
  name            text not null,
  description     text,
  status          project_status not null default 'active',
  started_at      date,
  planned_end_at  date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_projects_client on projects(client_id);

drop trigger if exists projects_updated_at on projects;
create trigger projects_updated_at
  before update on projects
  for each row execute function handle_updated_at();

-- Forward reference from migration 004: client_contacts.project_id
-- can only be FK'd once projects exists.
alter table client_contacts
  drop constraint if exists fk_contacts_project;
alter table client_contacts
  add constraint fk_contacts_project
  foreign key (project_id) references projects(id) on delete cascade;
