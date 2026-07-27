-- ============================================================
-- Aligned — Migration 007
-- Ticket assignees
--
-- Direct port of Chronos's work_item_assignees: multiple assignees
-- per ticket, each with who assigned them. Assignees are always
-- team members — clients raise and watch tickets, they never get
-- assigned to one.
-- ============================================================

create table if not exists ticket_assignees (
  id             uuid primary key default gen_random_uuid(),
  ticket_id      uuid not null references tickets(id) on delete cascade,
  team_member_id uuid not null references team_members(id) on delete cascade,
  assigned_by    uuid references team_members(id) on delete set null,
  assigned_at    timestamptz not null default now(),
  unique (ticket_id, team_member_id)
);

create index if not exists idx_ticket_assignees_ticket on ticket_assignees(ticket_id);
create index if not exists idx_ticket_assignees_member on ticket_assignees(team_member_id);

create or replace function is_ticket_assignee(p_ticket_id uuid, p_user_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from ticket_assignees
    where ticket_id = p_ticket_id and team_member_id = p_user_id
  );
$$;
