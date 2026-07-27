-- ============================================================
-- Aligned — Migration 008
-- Ticket comments
--
-- Direct port of Chronos's work_item_comments: body + edited_at
-- (trigger-stamped, drives an "edited" tag in the UI), same dual
-- authorship as tickets itself (migration 006) since a comment can
-- come from a team member or from the client's shared login.
--
-- RLS is deliberately NOT enabled here — it's added in migration
-- 010 alongside tickets/ticket_assignees so the visibility
-- predicate is written once and applied to all three together.
-- ============================================================

create table if not exists ticket_comments (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid not null references tickets(id) on delete cascade,
  body          text not null check (length(trim(body)) > 0),
  edited_at     timestamptz,

  created_by_team_member_id uuid references team_members(id) on delete set null,
  created_by_client_name    text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint ticket_comments_single_author check (
    (created_by_team_member_id is not null and created_by_client_name is null)
    or (created_by_team_member_id is null and created_by_client_name is not null)
  )
);

create index if not exists idx_ticket_comments_ticket on ticket_comments(ticket_id);

drop trigger if exists ticket_comments_updated_at on ticket_comments;
create trigger ticket_comments_updated_at
  before update on ticket_comments
  for each row execute function handle_updated_at();

create or replace function set_ticket_comment_edited_at()
returns trigger language plpgsql as $$
begin
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ticket_comments_edited_at on ticket_comments;
create trigger trg_ticket_comments_edited_at
  before update of body on ticket_comments
  for each row execute function set_ticket_comment_edited_at();

create or replace function get_ticket_creator(p_ticket_id uuid)
returns uuid language sql security definer stable as $$
  select created_by_team_member_id from tickets where id = p_ticket_id;
$$;
