-- ============================================================
-- Aligned — Migration 028
-- Restrict who can EDIT clients and projects (not just create)
--
-- Migration 025 restricted INSERT only, leaving UPDATE/DELETE open to
-- any authenticated team member. The product now draws a harder line:
-- clients (manager assignment, login/credentials, contacts, deletion)
-- are admin-only end to end; projects (status, other fields,
-- deletion) are admin-or-manager end to end. SELECT stays open to any
-- team member on both — this is an edit/write restriction, not a
-- visibility one.
--
-- client_contacts also moves off the old "for all" full-access policy
-- for the same reason (managing a client's default contacts is part
-- of "editing the client") — SELECT stays open (needed for mention/
-- recipient pickers elsewhere), INSERT/UPDATE/DELETE become admin-only.
-- ============================================================

drop policy if exists "clients_update_all" on clients;
create policy "clients_update_admin_only" on clients
  for update to authenticated
  using (coalesce((select role = 'admin' from team_members where id = auth.uid()), false))
  with check (coalesce((select role = 'admin' from team_members where id = auth.uid()), false));

drop policy if exists "clients_delete_all" on clients;
create policy "clients_delete_admin_only" on clients
  for delete to authenticated
  using (coalesce((select role = 'admin' from team_members where id = auth.uid()), false));

drop policy if exists "team_full_access_contacts" on client_contacts;

drop policy if exists "client_contacts_select_all" on client_contacts;
create policy "client_contacts_select_all" on client_contacts
  for select to authenticated using (true);

drop policy if exists "client_contacts_insert_admin_only" on client_contacts;
create policy "client_contacts_insert_admin_only" on client_contacts
  for insert to authenticated
  with check (coalesce((select role = 'admin' from team_members where id = auth.uid()), false));

drop policy if exists "client_contacts_update_admin_only" on client_contacts;
create policy "client_contacts_update_admin_only" on client_contacts
  for update to authenticated
  using (coalesce((select role = 'admin' from team_members where id = auth.uid()), false))
  with check (coalesce((select role = 'admin' from team_members where id = auth.uid()), false));

drop policy if exists "client_contacts_delete_admin_only" on client_contacts;
create policy "client_contacts_delete_admin_only" on client_contacts
  for delete to authenticated
  using (coalesce((select role = 'admin' from team_members where id = auth.uid()), false));

drop policy if exists "projects_update_all" on projects;
create policy "projects_update_admin_or_manager" on projects
  for update to authenticated
  using (coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false))
  with check (coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false));

drop policy if exists "projects_delete_all" on projects;
create policy "projects_delete_admin_or_manager" on projects
  for delete to authenticated
  using (coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false));
