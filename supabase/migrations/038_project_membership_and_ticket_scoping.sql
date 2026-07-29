-- ============================================================
-- Aligned — Migration 038
-- Project membership + ticket action scoping
--
-- New hierarchy: a project now has explicit team members
-- (project_members), and being on a project is what grants the
-- ability to ACT on its tickets (comment, change properties, assign,
-- attach files) — not the old client-Manager-hierarchy alone. Ticket
-- VISIBILITY, on the other hand, opens up to match every other table
-- in this app ("any authenticated team member has full access" —
-- see migration 018's comment): anyone can view/search any ticket,
-- they just can't act on one outside their projects. This directly
-- replaces migration 037's narrower SELECT policy — that narrowing
-- is superseded by this explicit, later product decision.
--
-- can_edit_ticket() (migration 010, tweaked 037) is extended with a
-- project-membership branch and becomes the single predicate for
-- every ticket write surface: tickets UPDATE, ticket_comments INSERT,
-- ticket_assignees INSERT/DELETE, and ticket-linked documents
-- INSERT/UPDATE/DELETE. A client's assigned Manager and admins keep
-- full access regardless of explicit project membership (confirmed
-- product decision — Manager's existing override isn't being
-- narrowed by this change).
--
-- Because the tickets SELECT policy no longer needs to re-query
-- tickets by id at all (it's now unconditionally open), the
-- INSERT...RETURNING self-reference problem migration 036 worked
-- around no longer applies to ticket creation — noted here, not
-- reverting 036's column-direct style since it's harmless either way.
-- ============================================================

-- ============================================================
-- project_members
-- ============================================================

create table if not exists project_members (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id) on delete cascade,
  team_member_id uuid not null references team_members(id) on delete cascade,
  added_by       uuid references team_members(id) on delete set null,
  added_at       timestamptz not null default now(),
  unique (project_id, team_member_id)
);

create index if not exists idx_project_members_project on project_members(project_id);
create index if not exists idx_project_members_member  on project_members(team_member_id);

create or replace function is_project_member(p_project_id uuid, p_user_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from project_members
    where project_id = p_project_id and team_member_id = p_user_id
  );
$$;

-- Who may add/remove people from a project's team: an admin, the
-- project's client's assigned Manager, or anyone already on the
-- project (confirmed product decision — membership management isn't
-- restricted to admin/manager the way project/milestone editing is).
create or replace function can_manage_project_members(p_project_id uuid, p_user_id uuid)
returns boolean language sql security definer stable as $$
  select
    coalesce((select role = 'admin' from team_members where id = p_user_id), false)
    or get_client_manager((select client_id from projects where id = p_project_id)) = p_user_id
    or is_project_member(p_project_id, p_user_id);
$$;

alter table project_members enable row level security;

drop policy if exists "project_members_select_all" on project_members;
create policy "project_members_select_all"
  on project_members for select to authenticated using (true);

drop policy if exists "project_members_insert" on project_members;
create policy "project_members_insert"
  on project_members for insert to authenticated
  with check (can_manage_project_members(project_id, auth.uid()));

drop policy if exists "project_members_delete" on project_members;
create policy "project_members_delete"
  on project_members for delete to authenticated
  using (can_manage_project_members(project_id, auth.uid()));

-- ============================================================
-- Ticket helper functions
-- ============================================================

create or replace function get_ticket_project(p_ticket_id uuid)
returns uuid language sql security definer stable as $$
  select project_id from tickets where id = p_ticket_id;
$$;

-- Who may act on a ticket (comment, change properties, manage
-- assignees, attach/remove files): admin, the client's assigned
-- Manager, a member of the ticket's project (if it has one), an
-- assignee, or the creator.
create or replace function can_edit_ticket(p_ticket_id uuid, p_user_id uuid)
returns boolean language sql security definer stable as $$
  select
    is_client_manager_or_admin(get_ticket_client(p_ticket_id), p_user_id)
    or (
      get_ticket_project(p_ticket_id) is not null
      and is_project_member(get_ticket_project(p_ticket_id), p_user_id)
    )
    or get_ticket_creator(p_ticket_id) = p_user_id
    or is_ticket_assignee(p_ticket_id, p_user_id);
$$;

-- Who is *eligible to be assigned* to a ticket: admins always; for a
-- project-linked ticket, that project's members; for a legacy/no-
-- project ticket, fall back to the old client-team pool (there's no
-- project to check membership against).
create or replace function can_be_ticket_assignee(p_ticket_id uuid, p_candidate_id uuid)
returns boolean language sql security definer stable as $$
  select
    coalesce((select role = 'admin' from team_members where id = p_candidate_id), false)
    or (
      get_ticket_project(p_ticket_id) is not null
      and is_project_member(get_ticket_project(p_ticket_id), p_candidate_id)
    )
    or (
      get_ticket_project(p_ticket_id) is null
      and is_on_client_team(get_ticket_client(p_ticket_id), p_candidate_id)
    );
$$;

-- ============================================================
-- tickets — open SELECT (view/search any ticket), scoped writes
-- ============================================================

drop policy if exists "View tickets on the client's team" on tickets;
create policy "View tickets on the client's team"
  on tickets for select to authenticated using (true);

drop policy if exists "Any active team member can create a ticket" on tickets;
create policy "Any active team member can create a ticket"
  on tickets for insert
  with check (
    created_by_team_member_id = auth.uid()
    and coalesce((select is_active from team_members where id = auth.uid()), false)
    and (
      project_id is null
      or is_client_manager_or_admin(client_id, auth.uid())
      or is_project_member(project_id, auth.uid())
    )
  );

drop policy if exists "Edit tickets you own or are assigned" on tickets;
create policy "Edit tickets you own or are assigned"
  on tickets for update
  using (can_edit_ticket(id, auth.uid()))
  with check (can_edit_ticket(id, auth.uid()));

-- "Admins and managers delete tickets" (migration 010) is unchanged —
-- still admin, the client's manager, or the creator.

-- ============================================================
-- ticket_assignees — open SELECT, writes gated by can_edit_ticket +
-- can_be_ticket_assignee (replaces the three migration-010 policies,
-- which are now fully subsumed: can_edit_ticket already covers
-- "existing assignee extends" and "remove yourself" via its own
-- is_ticket_assignee branch).
-- ============================================================

drop policy if exists "View assignees on visible tickets"      on ticket_assignees;
drop policy if exists "Managers and creators manage assignees" on ticket_assignees;
drop policy if exists "Assignees can extend the ticket"         on ticket_assignees;
drop policy if exists "Users can remove themselves"             on ticket_assignees;

create policy "View assignees on any ticket"
  on ticket_assignees for select to authenticated using (true);

create policy "Add assignees on tickets you can act on"
  on ticket_assignees for insert
  with check (
    can_edit_ticket(ticket_id, auth.uid())
    and can_be_ticket_assignee(ticket_id, team_member_id)
  );

create policy "Remove assignees on tickets you can act on"
  on ticket_assignees for delete
  using (can_edit_ticket(ticket_id, auth.uid()));

-- ============================================================
-- ticket_comments — open SELECT, posting gated by can_edit_ticket
-- ============================================================

drop policy if exists "View comments on visible tickets" on ticket_comments;
create policy "View comments on any ticket"
  on ticket_comments for select to authenticated using (true);

drop policy if exists "Comment on visible tickets" on ticket_comments;
create policy "Comment on tickets you can act on"
  on ticket_comments for insert
  with check (
    created_by_team_member_id = auth.uid()
    and can_edit_ticket(ticket_id, auth.uid())
  );

-- "Authors can edit own comments" / "Authors and managers delete
-- comments" (migration 010) are unchanged.

-- ============================================================
-- documents — split ticket-linked rows out from the admin/manager-
-- only project-content policy (migration 029), which was never meant
-- to gate ticket attachments in the first place. Ticket attachments
-- now follow can_edit_ticket, same as every other ticket write.
-- ============================================================

drop policy if exists "documents_insert_admin_or_manager" on documents;
create policy "documents_insert_admin_or_manager" on documents
  for insert to authenticated
  with check (
    ticket_id is null
    and coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false)
  );

drop policy if exists "documents_update_admin_or_manager" on documents;
create policy "documents_update_admin_or_manager" on documents
  for update to authenticated
  using (
    ticket_id is null
    and coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false)
  )
  with check (
    ticket_id is null
    and coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false)
  );

drop policy if exists "documents_delete_admin_or_manager" on documents;
create policy "documents_delete_admin_or_manager" on documents
  for delete to authenticated
  using (
    ticket_id is null
    and coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false)
  );

drop policy if exists "documents_ticket_attachment_insert" on documents;
create policy "documents_ticket_attachment_insert" on documents
  for insert to authenticated
  with check (ticket_id is not null and can_edit_ticket(ticket_id, auth.uid()));

drop policy if exists "documents_ticket_attachment_update" on documents;
create policy "documents_ticket_attachment_update" on documents
  for update to authenticated
  using (ticket_id is not null and can_edit_ticket(ticket_id, auth.uid()))
  with check (ticket_id is not null and can_edit_ticket(ticket_id, auth.uid()));

drop policy if exists "documents_ticket_attachment_delete" on documents;
create policy "documents_ticket_attachment_delete" on documents
  for delete to authenticated
  using (ticket_id is not null and can_edit_ticket(ticket_id, auth.uid()));

-- documents_select_all (migration 029) stays open — viewing/downloading
-- an attachment was never restricted and still isn't.

grant select, insert, delete on project_members to authenticated;
