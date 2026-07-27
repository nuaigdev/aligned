-- ============================================================
-- Aligned — Migration 013
-- Approval links
--
-- Unchanged from the original design. One recipient per link; the
-- first to sign locks the decision/milestone and all other pending
-- links for the same target are marked 'superseded'. This is the
-- one-time email sign-off mechanism and is untouched by the move to
-- client login — signing only ever happens via a named recipient's
-- emailed link, never from the portal itself.
-- ============================================================

do $$ begin
  create type approval_target_type as enum ('decision', 'milestone');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type approval_status as enum ('pending', 'signed', 'expired', 'superseded');
exception when duplicate_object then null;
end $$;

create table if not exists approval_links (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects(id) on delete cascade,
  target_type       approval_target_type not null,
  target_id         uuid not null,
  token             text not null unique default encode(gen_random_bytes(32), 'hex'),
  recipient_name    text not null,
  recipient_email   text not null,
  status            approval_status not null default 'pending',
  signed_at         timestamptz,
  concern_text      text,
  concern_raised_at timestamptz,
  nudge_count       int not null default 0,
  last_nudge_at     timestamptz,
  expires_at        timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists idx_approval_links_token   on approval_links(token);
create index if not exists idx_approval_links_target  on approval_links(target_type, target_id);
create index if not exists idx_approval_links_project on approval_links(project_id);
