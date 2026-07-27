-- ============================================================
-- Aligned — Migration 015
-- Milestone sign-offs
--
-- The immutable audit record — separate from approval_links, which
-- is the in-flight tracking row. Unchanged from the original design.
-- ============================================================

create table if not exists milestone_signoffs (
  id                uuid primary key default gen_random_uuid(),
  milestone_id      uuid not null references milestones(id) on delete cascade,
  approval_link_id  uuid references approval_links(id),
  signed_by_name    text not null,
  signed_by_email   text not null,
  signed_at         timestamptz not null default now(),
  ip_address        text,
  user_agent        text
);

create index if not exists idx_signoffs_milestone on milestone_signoffs(milestone_id);
