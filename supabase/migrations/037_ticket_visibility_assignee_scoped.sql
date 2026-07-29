-- ============================================================
-- Aligned — Migration 037
-- Narrow ticket visibility for plain 'member' team members to
-- "created by me" or "assigned to me" only
--
-- Previously (migration 010), can_view_ticket() granted visibility
-- via is_on_client_team(), which includes anyone whose manager_id
-- points at the client's assigned Manager — i.e. every direct report
-- of that Manager could see every ticket for that client, whether or
-- not they had anything to do with it. That's now intentionally
-- narrower: a plain 'member' should only see tickets they raised
-- themselves or are explicitly assigned to. Admins still see
-- everything; a client's actual assigned Manager still sees every
-- ticket for their clients (they're the one triaging/routing, so
-- they need the full queue) — only the "any of the Manager's other
-- reports" branch is removed.
--
-- New shared predicate is_client_manager_or_admin() replaces the
-- is_on_client_team() call inside can_view_ticket() and inside the
-- tickets table's own SELECT policy — kept as one function per
-- CLAUDE.md rule 11 (never re-implement a shared predicate inline in
-- more than one place) rather than duplicating the admin/manager
-- check in both spots.
--
-- The tickets table's own SELECT policy still can't call
-- can_view_ticket()/get_ticket_client()/get_ticket_creator() (those
-- re-query tickets by id, which breaks INSERT...RETURNING — see
-- migration 036) — it stays written against the row's own columns
-- directly, just with the narrower predicate swapped in.
--
-- is_on_client_team() itself is untouched and still used elsewhere
-- (assignee-eligibility checks, @mention filtering) — who's
-- *assignable* to a client's tickets stays as wide as before; it's
-- specifically *default visibility without being assigned* that
-- narrows here.
-- ============================================================

create or replace function is_client_manager_or_admin(p_client_id uuid, p_user_id uuid)
returns boolean language sql security definer stable as $$
  select
    coalesce((select role = 'admin' from team_members where id = p_user_id), false)
    or get_client_manager(p_client_id) = p_user_id;
$$;

create or replace function can_view_ticket(p_ticket_id uuid, p_user_id uuid)
returns boolean language sql security definer stable as $$
  select
    is_client_manager_or_admin(get_ticket_client(p_ticket_id), p_user_id)
    or is_ticket_assignee(p_ticket_id, p_user_id)
    or get_ticket_creator(p_ticket_id) = p_user_id;
$$;

-- Same admin/manager check, expressed via the shared predicate above
-- instead of its own inline copy — editing rights are unchanged by
-- this migration, this is a dedup only.
create or replace function can_edit_ticket(p_ticket_id uuid, p_user_id uuid)
returns boolean language sql security definer stable as $$
  select
    is_client_manager_or_admin(get_ticket_client(p_ticket_id), p_user_id)
    or get_ticket_creator(p_ticket_id) = p_user_id
    or is_ticket_assignee(p_ticket_id, p_user_id);
$$;

drop policy if exists "View tickets on the client's team" on tickets;

create policy "View tickets on the client's team"
  on tickets for select
  using (
    auth.role() = 'authenticated'
    and (
      is_client_manager_or_admin(client_id, auth.uid())
      or created_by_team_member_id = auth.uid()
      or exists (
        select 1 from ticket_assignees
        where ticket_assignees.ticket_id = tickets.id
          and ticket_assignees.team_member_id = auth.uid()
      )
    )
  );
