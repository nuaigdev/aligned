-- ============================================================
-- Aligned — Migration 025
-- Restrict who can CREATE clients and projects
--
-- Splits the single "for all" full-team policy on clients/projects
-- (migration 018) into per-operation policies: SELECT/UPDATE/DELETE
-- stay "any authenticated team member" (unchanged, per CLAUDE.md's
-- rule about not retrofitting the ticket RBAC model onto these
-- tables) — only INSERT is restricted, since that's the one the
-- product now draws a hard line on: only admins add clients; only
-- admins and managers add projects. The Server Action layer enforces
-- the same rule and is the primary UX (clear error messages); this
-- is defense in depth against a direct table write.
-- ============================================================

drop policy if exists "team_full_access_clients" on clients;

create policy "clients_select_all" on clients
  for select to authenticated using (true);

create policy "clients_update_all" on clients
  for update to authenticated using (true) with check (true);

create policy "clients_delete_all" on clients
  for delete to authenticated using (true);

drop policy if exists "clients_insert_admin_only" on clients;
create policy "clients_insert_admin_only" on clients
  for insert to authenticated
  with check (coalesce((select role = 'admin' from team_members where id = auth.uid()), false));

drop policy if exists "team_full_access_projects" on projects;

create policy "projects_select_all" on projects
  for select to authenticated using (true);

create policy "projects_update_all" on projects
  for update to authenticated using (true) with check (true);

create policy "projects_delete_all" on projects
  for delete to authenticated using (true);

drop policy if exists "projects_insert_admin_or_manager" on projects;
create policy "projects_insert_admin_or_manager" on projects
  for insert to authenticated
  with check (coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false));
