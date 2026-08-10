-- ============================================================
-- NuAIg Assist — Migration 048
-- Managers get full client management access
--
-- Migration 028 drew "editing a client" (rename, manager assignment,
-- portal login credentials, deletion) as admin-only end to end.
-- Confirmed product decision: managers should have the same access to
-- a client's "Manager & portal access" panel that admins do — change
-- or add the assigned Manager, and issue/reset/revoke portal login
-- credentials. Mirrors clients_insert_admin_or_manager (migration 046)
-- and projects_update_admin_or_manager (migration 028). Deletion stays
-- admin-only (clients_delete_admin_only, untouched) — not part of this
-- ask, and destructive.
-- ============================================================

drop policy if exists "clients_update_admin_only" on clients;
create policy "clients_update_admin_or_manager" on clients
  for update to authenticated
  using (coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false))
  with check (coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false));

drop policy if exists "client_logins_insert_admin_only" on client_logins;
create policy "client_logins_insert_admin_or_manager" on client_logins
  for insert to authenticated
  with check (coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false));

drop policy if exists "client_logins_update_admin_only" on client_logins;
create policy "client_logins_update_admin_or_manager" on client_logins
  for update to authenticated
  using (coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false))
  with check (coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false));

drop policy if exists "client_logins_delete_admin_only" on client_logins;
create policy "client_logins_delete_admin_or_manager" on client_logins
  for delete to authenticated
  using (coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false));
