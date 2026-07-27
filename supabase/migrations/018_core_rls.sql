-- ============================================================
-- Aligned — Migration 018
-- Core RLS — everything except tickets
--
-- Same "any authenticated team member has full access" model as
-- the original schema — deliberately NOT retrofitted with the
-- Manager/RBAC restriction that tickets get in migration 010. That
-- restriction is scoped to tickets only for this pass.
--
-- One real fix here: the original team_members policy was
-- "own record only" (`using (id = auth.uid())`), which would have
-- silently broken every Manager/assignee picker in the new ticket
-- UI (you can't populate a dropdown of team members you're not
-- allowed to SELECT). Team members can now all see each other
-- (name/role/manager — needed for org-chart-style pickers
-- everywhere); only admins may edit someone else's row.
--
-- Portal (client) access does not go through these policies at all
-- — it's mediated by createServiceRoleClient() + a verified session
-- cookie, same as it bypasses RLS today (see CLAUDE.md).
-- ============================================================

alter table clients            enable row level security;
alter table client_contacts    enable row level security;
alter table projects           enable row level security;
alter table milestones         enable row level security;
alter table decisions          enable row level security;
alter table approval_links     enable row level security;
alter table documents          enable row level security;
alter table milestone_signoffs enable row level security;
alter table team_members       enable row level security;

drop policy if exists "team_full_access_clients"   on clients;
create policy "team_full_access_clients"
  on clients for all to authenticated using (true) with check (true);

drop policy if exists "team_full_access_contacts"  on client_contacts;
create policy "team_full_access_contacts"
  on client_contacts for all to authenticated using (true) with check (true);

drop policy if exists "team_full_access_projects"  on projects;
create policy "team_full_access_projects"
  on projects for all to authenticated using (true) with check (true);

drop policy if exists "team_full_access_milestones" on milestones;
create policy "team_full_access_milestones"
  on milestones for all to authenticated using (true) with check (true);

drop policy if exists "team_full_access_decisions" on decisions;
create policy "team_full_access_decisions"
  on decisions for all to authenticated using (true) with check (true);

drop policy if exists "team_full_access_approvals" on approval_links;
create policy "team_full_access_approvals"
  on approval_links for all to authenticated using (true) with check (true);

drop policy if exists "team_full_access_documents" on documents;
create policy "team_full_access_documents"
  on documents for all to authenticated using (true) with check (true);

drop policy if exists "team_full_access_signoffs"  on milestone_signoffs;
create policy "team_full_access_signoffs"
  on milestone_signoffs for all to authenticated using (true) with check (true);

drop policy if exists "team_members_own_record" on team_members;
drop policy if exists "team_members_view_all"   on team_members;
drop policy if exists "team_members_update_own_or_admin" on team_members;
drop policy if exists "team_members_admin_delete" on team_members;

create policy "team_members_view_all"
  on team_members for select to authenticated using (true);

create policy "team_members_update_own_or_admin"
  on team_members for update to authenticated
  using (
    id = auth.uid()
    or coalesce((select role = 'admin' from team_members where id = auth.uid()), false)
  )
  with check (
    id = auth.uid()
    or coalesce((select role = 'admin' from team_members where id = auth.uid()), false)
  );

create policy "team_members_admin_delete"
  on team_members for delete to authenticated
  using (coalesce((select role = 'admin' from team_members where id = auth.uid()), false));
