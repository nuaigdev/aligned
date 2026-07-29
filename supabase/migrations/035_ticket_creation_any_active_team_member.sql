-- ============================================================
-- Aligned — Migration 035
-- Any active team member can create a ticket
--
-- Migration 010's insert policy required is_on_client_team(client_id,
-- auth.uid()) — a member could only raise a ticket for a client whose
-- assigned Manager was their own manager. That's fragile: a single
-- missing manager_id relationship (on the team member OR the client)
-- silently blocks a legitimate teammate from logging any ticket at
-- all, with nothing more helpful than a generic RLS error surfacing
-- in the UI. That's exactly what happened — a member's ticket
-- creation failed because the manager wiring wasn't in place yet,
-- burning two ticket_ref_seq values in the process (see the docstring
-- in migration 006: sequences aren't transactional, so a rejected
-- insert still consumes its nextval()).
--
-- Ticketing is meant to be the app's front door — anyone on the team
-- should be able to log something for any client. This does not
-- loosen anything else: can_view_ticket()/can_edit_ticket() already
-- grant a ticket's creator permanent access to what they raised
-- regardless of hierarchy, and notification routing already goes to
-- the client's actual manager_id (not the creator's manager), so
-- triage is unaffected. Only who may INSERT changes here.
-- ============================================================

drop policy if exists "Create tickets within your team scope" on tickets;

create policy "Any active team member can create a ticket"
  on tickets for insert
  with check (
    created_by_team_member_id = auth.uid()
    and coalesce((select is_active from team_members where id = auth.uid()), false)
  );
