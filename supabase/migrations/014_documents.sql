-- ============================================================
-- Aligned — Migration 014
-- Documents
--
-- Same design as the original schema (attribution-only, no signing
-- on documents — see CLAUDE.md), plus one addition: a nullable
-- ticket_id alongside the existing nullable milestone_id/
-- decision_id, so a client's bug-report screenshot or a team
-- reply's attachment reuses this vault instead of a parallel one.
-- Chronos's work board has no attachment concept at all — this is
-- new for Aligned.
-- ============================================================

do $$ begin
  create type document_shared_by as enum ('team', 'client');
exception when duplicate_object then null;
end $$;

create table if not exists documents (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  milestone_id    uuid references milestones(id) on delete set null,
  decision_id     uuid references decisions(id) on delete set null,
  ticket_id       uuid references tickets(id) on delete set null,
  name            text not null,
  storage_path    text not null,
  file_type       text,
  file_size_bytes bigint,
  phase           text,
  shared_by       document_shared_by not null default 'team',
  uploaded_by     text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_documents_project   on documents(project_id);
create index if not exists idx_documents_milestone on documents(milestone_id);
create index if not exists idx_documents_ticket    on documents(ticket_id);
