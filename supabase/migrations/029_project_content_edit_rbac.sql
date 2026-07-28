-- ============================================================
-- Aligned — Migration 029
-- Restrict who can EDIT project-level content
--
-- Milestones, decisions, documents, and approval links are all
-- project-scoped content that until now used the original "any
-- authenticated team member has full access" model (migration 018).
-- The product now draws the same line here as it does for projects
-- themselves (migration 028): admins and managers can create/update/
-- delete this content; any team member can still view it (needed for
-- assignee/mention pickers and general visibility).
-- ============================================================

drop policy if exists "team_full_access_milestones" on milestones;

drop policy if exists "milestones_select_all" on milestones;
create policy "milestones_select_all" on milestones
  for select to authenticated using (true);

drop policy if exists "milestones_write_admin_or_manager" on milestones;
create policy "milestones_write_admin_or_manager" on milestones
  for insert to authenticated
  with check (coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false));

drop policy if exists "milestones_update_admin_or_manager" on milestones;
create policy "milestones_update_admin_or_manager" on milestones
  for update to authenticated
  using (coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false))
  with check (coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false));

drop policy if exists "milestones_delete_admin_or_manager" on milestones;
create policy "milestones_delete_admin_or_manager" on milestones
  for delete to authenticated
  using (coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false));

drop policy if exists "team_full_access_decisions" on decisions;

drop policy if exists "decisions_select_all" on decisions;
create policy "decisions_select_all" on decisions
  for select to authenticated using (true);

drop policy if exists "decisions_insert_admin_or_manager" on decisions;
create policy "decisions_insert_admin_or_manager" on decisions
  for insert to authenticated
  with check (coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false));

drop policy if exists "decisions_update_admin_or_manager" on decisions;
create policy "decisions_update_admin_or_manager" on decisions
  for update to authenticated
  using (coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false))
  with check (coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false));

drop policy if exists "decisions_delete_admin_or_manager" on decisions;
create policy "decisions_delete_admin_or_manager" on decisions
  for delete to authenticated
  using (coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false));

drop policy if exists "team_full_access_documents" on documents;

drop policy if exists "documents_select_all" on documents;
create policy "documents_select_all" on documents
  for select to authenticated using (true);

drop policy if exists "documents_insert_admin_or_manager" on documents;
create policy "documents_insert_admin_or_manager" on documents
  for insert to authenticated
  with check (coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false));

drop policy if exists "documents_update_admin_or_manager" on documents;
create policy "documents_update_admin_or_manager" on documents
  for update to authenticated
  using (coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false))
  with check (coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false));

drop policy if exists "documents_delete_admin_or_manager" on documents;
create policy "documents_delete_admin_or_manager" on documents
  for delete to authenticated
  using (coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false));

drop policy if exists "team_full_access_approvals" on approval_links;

drop policy if exists "approval_links_select_all" on approval_links;
create policy "approval_links_select_all" on approval_links
  for select to authenticated using (true);

drop policy if exists "approval_links_insert_admin_or_manager" on approval_links;
create policy "approval_links_insert_admin_or_manager" on approval_links
  for insert to authenticated
  with check (coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false));

drop policy if exists "approval_links_update_admin_or_manager" on approval_links;
create policy "approval_links_update_admin_or_manager" on approval_links
  for update to authenticated
  using (coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false))
  with check (coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false));

drop policy if exists "approval_links_delete_admin_or_manager" on approval_links;
create policy "approval_links_delete_admin_or_manager" on approval_links
  for delete to authenticated
  using (coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false));
