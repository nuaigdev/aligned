-- ============================================================
-- Aligned — Migration 036
-- Fix "new row violates row-level security policy for table tickets"
-- on ticket creation for non-admin team members
--
-- Root cause: the tickets SELECT policy (migration 010) calls
-- can_view_ticket(id, auth.uid()), which internally resolves the
-- ticket's client_id/creator via get_ticket_client(id)/
-- get_ticket_creator(id) — both of which re-query the tickets table
-- by id. For a plain INSERT this is irrelevant, but
-- supabase-js's `.insert().select()` (used by createTicket() in
-- lib/tickets/team-actions.ts) compiles to `INSERT ... RETURNING`,
-- and Postgres re-checks the table's SELECT policy against the row
-- being returned. A policy that re-queries the SAME table it's
-- protecting can't see its own not-yet-committed row from that
-- nested query (a well-known RLS self-reference limitation) — so
-- get_ticket_client()/get_ticket_creator() come back NULL during
-- that specific check, and every branch of can_view_ticket()
-- evaluates false/NULL *except* the "is admin" branch, which doesn't
-- need the ticket row at all. That's exactly why the admin's ticket
-- creation succeeded while a 'member' (or a 'manager', had one been
-- tested) creating any ticket — even for their own client — failed
-- outright.
--
-- Fix: rewrite ONLY the tickets table's own SELECT policy to check
-- client_id / created_by_team_member_id directly off the row being
-- evaluated (already in scope, no re-query needed) instead of
-- routing through the helper functions. can_view_ticket() itself is
-- untouched and still used as-is by ticket_comments/ticket_assignees
-- — those are inserted only after their parent ticket is already a
-- committed, visible row (an FK requires it to exist), so they never
-- hit this same-command visibility gap.
-- ============================================================

drop policy if exists "View tickets on the client's team" on tickets;

create policy "View tickets on the client's team"
  on tickets for select
  using (
    auth.role() = 'authenticated'
    and (
      is_on_client_team(client_id, auth.uid())
      or created_by_team_member_id = auth.uid()
      or exists (
        select 1 from ticket_assignees
        where ticket_assignees.ticket_id = tickets.id
          and ticket_assignees.team_member_id = auth.uid()
      )
    )
  );
