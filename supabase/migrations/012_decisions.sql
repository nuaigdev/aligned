-- ============================================================
-- Aligned — Migration 012
-- Decisions
--
-- One real fix versus the original design: ref_number used to be
-- computed in the application as `max(ref_number) + 1` per project
-- (next_decision_ref), which races under concurrent inserts — two
-- decisions created for the same project at the same moment could
-- both compute the same next number. It's now assigned by a
-- trigger that takes a per-project advisory lock before computing
-- the max, so concurrent inserts for the same project serialize
-- instead of colliding. next_decision_ref() is kept as a read-only
-- preview helper for the UI (e.g. showing "this will be D-009"
-- before submit) — it is NOT the authoritative source anymore.
-- ============================================================

do $$ begin
  create type decision_status as enum (
    'draft',
    'pending_approval',
    'approved',
    'amended'
  );
exception when duplicate_object then null;
end $$;

create table if not exists decisions (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  ref_number      int,
  title           text not null,
  description     text,
  status          decision_status not null default 'draft',
  meeting_ref     text,
  signed_at       timestamptz,
  signed_by_name  text,
  signed_by_email text,
  parent_id       uuid references decisions(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (project_id, ref_number)
);

create index if not exists idx_decisions_project on decisions(project_id);

drop trigger if exists decisions_updated_at on decisions;
create trigger decisions_updated_at
  before update on decisions
  for each row execute function handle_updated_at();

-- Read-only preview helper — NOT used for the authoritative insert
-- anymore (see assign_decision_ref below), just for UI preview text.
create or replace function next_decision_ref(p_project_id uuid)
returns int language sql stable as $$
  select coalesce(max(ref_number), 0) + 1
  from decisions
  where project_id = p_project_id;
$$;

create or replace function assign_decision_ref()
returns trigger language plpgsql as $$
begin
  if new.ref_number is null then
    -- Serializes concurrent inserts for the same project; the lock
    -- is released automatically at transaction end.
    perform pg_advisory_xact_lock(hashtextextended(new.project_id::text, 0));
    select coalesce(max(ref_number), 0) + 1 into new.ref_number
    from decisions
    where project_id = new.project_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_decisions_assign_ref on decisions;
create trigger trg_decisions_assign_ref
  before insert on decisions
  for each row execute function assign_decision_ref();
