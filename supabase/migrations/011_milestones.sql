-- ============================================================
-- Aligned — Migration 011
-- Milestones
--
-- Unchanged design from the original schema. Regression (e.g. UAT
-- fails, goes back to dev) is handled by re-opening a milestone and
-- incrementing iteration — the old iteration stays in history via
-- parent_id. Never delete milestone records.
-- ============================================================

do $$ begin
  create type milestone_type as enum (
    'client_gate',
    'internal',
    'informational'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type milestone_status as enum (
    'not_started',
    'in_progress',
    'awaiting_signoff',
    'completed',
    'reopened'
  );
exception when duplicate_object then null;
end $$;

create table if not exists milestones (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  title         text not null,
  description   text,
  type          milestone_type not null default 'internal',
  status        milestone_status not null default 'not_started',
  phase         text,
  due_date      date,
  completed_at  timestamptz,
  iteration     int not null default 1,
  parent_id     uuid references milestones(id),
  delay_owner   text check (delay_owner in ('client', 'team')),
  delay_reason  text,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_milestones_project on milestones(project_id);

drop trigger if exists milestones_updated_at on milestones;
create trigger milestones_updated_at
  before update on milestones
  for each row execute function handle_updated_at();
