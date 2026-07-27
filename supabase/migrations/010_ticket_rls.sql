-- ============================================================
-- Aligned — Migration 010
-- Ticket RLS — visibility, assignment, and comments together
--
-- This is the payoff of extracting is_on_client_team() /
-- get_ticket_client() / get_client_manager() in migration 006: one
-- predicate, called from tickets, ticket_assignees, AND
-- ticket_comments, so "who can see this ticket" can never drift
-- into three slightly-different copies.
--
-- Visibility (can_view_ticket): admins; the client's assigned
-- Manager; anyone reporting to that Manager (on_client_team); plus
-- the ticket's assignees and creator explicitly, so a person never
-- loses sight of a ticket they touched even if the client's Manager
-- later changes.
--
-- Editing is narrower than viewing on purpose (mirrors Chronos's
-- work_items precedent): admin, the client's Manager, the creator,
-- or an assignee — not just "anyone who can view the board."
--
-- Client-authored rows (created_by_client_name set) are written
-- through the service-role client from portal server actions, which
-- bypasses RLS entirely — same architecture as the rest of the
-- portal today. These policies govern team-authenticated access.
-- ============================================================

alter table tickets         enable row level security;
alter table ticket_assignees enable row level security;
alter table ticket_comments  enable row level security;

create or replace function can_view_ticket(p_ticket_id uuid, p_user_id uuid)
returns boolean language sql security definer stable as $$
  select
    is_on_client_team(get_ticket_client(p_ticket_id), p_user_id)
    or is_ticket_assignee(p_ticket_id, p_user_id)
    or get_ticket_creator(p_ticket_id) = p_user_id;
$$;

create or replace function can_edit_ticket(p_ticket_id uuid, p_user_id uuid)
returns boolean language sql security definer stable as $$
  select
    coalesce((select role = 'admin' from team_members where id = p_user_id), false)
    or get_client_manager(get_ticket_client(p_ticket_id)) = p_user_id
    or get_ticket_creator(p_ticket_id) = p_user_id
    or is_ticket_assignee(p_ticket_id, p_user_id);
$$;

-- ============================================================
-- tickets
-- ============================================================

drop policy if exists "View tickets on the client's team"      on tickets;
drop policy if exists "Create tickets within your team scope"  on tickets;
drop policy if exists "Edit tickets you own or are assigned"   on tickets;
drop policy if exists "Admins and managers delete tickets"     on tickets;

create policy "View tickets on the client's team"
  on tickets for select
  using (
    auth.role() = 'authenticated'
    and can_view_ticket(id, auth.uid())
  );

create policy "Create tickets within your team scope"
  on tickets for insert
  with check (
    created_by_team_member_id = auth.uid()
    and is_on_client_team(client_id, auth.uid())
  );

create policy "Edit tickets you own or are assigned"
  on tickets for update
  using (can_edit_ticket(id, auth.uid()))
  with check (is_on_client_team(client_id, auth.uid()));

create policy "Admins and managers delete tickets"
  on tickets for delete
  using (
    coalesce((select role = 'admin' from team_members where id = auth.uid()), false)
    or get_client_manager(client_id) = auth.uid()
    or created_by_team_member_id = auth.uid()
  );

-- ============================================================
-- ticket_assignees
-- ============================================================

drop policy if exists "View assignees on visible tickets"      on ticket_assignees;
drop policy if exists "Managers and creators manage assignees" on ticket_assignees;
drop policy if exists "Assignees can extend the ticket"        on ticket_assignees;
drop policy if exists "Users can remove themselves"            on ticket_assignees;

create policy "View assignees on visible tickets"
  on ticket_assignees for select
  using (can_view_ticket(ticket_id, auth.uid()));

create policy "Managers and creators manage assignees"
  on ticket_assignees for all
  using (
    coalesce((select role = 'admin' from team_members where id = auth.uid()), false)
    or get_client_manager(get_ticket_client(ticket_id)) = auth.uid()
    or get_ticket_creator(ticket_id) = auth.uid()
  )
  with check (
    is_on_client_team(get_ticket_client(ticket_id), team_member_id)
    and (
      coalesce((select role = 'admin' from team_members where id = auth.uid()), false)
      or get_client_manager(get_ticket_client(ticket_id)) = auth.uid()
      or get_ticket_creator(ticket_id) = auth.uid()
    )
  );

-- An existing assignee may "extend" the ticket to someone else on
-- the same team — direct port of Chronos migration 027.
create policy "Assignees can extend the ticket"
  on ticket_assignees for insert
  with check (
    is_ticket_assignee(ticket_id, auth.uid())
    and is_on_client_team(get_ticket_client(ticket_id), team_member_id)
  );

create policy "Users can remove themselves"
  on ticket_assignees for delete
  using (team_member_id = auth.uid());

-- ============================================================
-- ticket_comments
-- ============================================================

drop policy if exists "View comments on visible tickets"        on ticket_comments;
drop policy if exists "Comment on visible tickets"               on ticket_comments;
drop policy if exists "Authors can edit own comments"            on ticket_comments;
drop policy if exists "Authors and managers delete comments"     on ticket_comments;

create policy "View comments on visible tickets"
  on ticket_comments for select
  using (can_view_ticket(ticket_id, auth.uid()));

create policy "Comment on visible tickets"
  on ticket_comments for insert
  with check (
    created_by_team_member_id = auth.uid()
    and can_view_ticket(ticket_id, auth.uid())
  );

create policy "Authors can edit own comments"
  on ticket_comments for update
  using (created_by_team_member_id = auth.uid())
  with check (created_by_team_member_id = auth.uid());

create policy "Authors and managers delete comments"
  on ticket_comments for delete
  using (
    created_by_team_member_id = auth.uid()
    or coalesce((select role = 'admin' from team_members where id = auth.uid()), false)
    or get_client_manager(get_ticket_client(ticket_id)) = auth.uid()
  );

-- ============================================================
-- GRANTS + REALTIME (team dashboard uses genuine Supabase Realtime;
-- the client portal doesn't — see CLAUDE.md notes on the portal's
-- non-Supabase-Auth session model)
-- ============================================================

grant select, insert, update, delete on tickets          to authenticated;
grant select, insert, update, delete on ticket_assignees  to authenticated;
grant select, insert, update, delete on ticket_comments   to authenticated;

do $$ begin
  alter publication supabase_realtime add table tickets;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table ticket_assignees;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table ticket_comments;
exception when duplicate_object then null;
end $$;
