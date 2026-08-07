-- ============================================================
-- NuAIg Assist — Migration 045
-- Multiple named portal logins per client
--
-- Replaces the single shared clients.login_id/password_hash/
-- must_change_password/last_login_at with a client_logins table.
-- A client can now have several logins — one per named contact —
-- each with its own independent login id + password. All logins
-- for a client see the exact same client-scoped portal data; the
-- only difference between them is who is signed in, which is now
-- known server-side from the session instead of a manually typed
-- "posting as" name (see app-side removal of ContactNamePicker in
-- the same change).
--
-- Any existing shared credential is carried forward as that
-- client's first login (named "Primary") so no client loses portal
-- access when this ships.
-- ============================================================

create table if not exists client_logins (
  id                    uuid primary key default gen_random_uuid(),
  client_id             uuid not null references clients(id) on delete cascade,
  contact_name          text not null,
  login_id              text not null unique,
  password_hash         text not null,
  must_change_password  boolean not null default true,
  is_active             boolean not null default true,
  last_login_at         timestamptz,
  created_at            timestamptz not null default now(),
  created_by            uuid references team_members(id) on delete set null
);

create index if not exists idx_client_logins_client    on client_logins(client_id);
create index if not exists idx_client_logins_login_id  on client_logins(login_id);

-- Carry the existing shared credential forward as this client's first login.
insert into client_logins (client_id, contact_name, login_id, password_hash, must_change_password, last_login_at)
select id, 'Primary', login_id, password_hash, coalesce(must_change_password, true), last_login_at
from clients
where login_id is not null and password_hash is not null
on conflict (login_id) do nothing;

alter table clients drop column if exists login_id;
alter table clients drop column if exists password_hash;
alter table clients drop column if exists must_change_password;
alter table clients drop column if exists last_login_at;

alter table client_logins enable row level security;

-- Same shape as client_contacts (migration 028): any team member can read
-- (needed for the "who's logged in" picker on the client page), but only
-- an admin can issue, rename, reset, or revoke a login.
drop policy if exists "client_logins_select_all" on client_logins;
create policy "client_logins_select_all" on client_logins
  for select to authenticated using (true);

drop policy if exists "client_logins_insert_admin_only" on client_logins;
create policy "client_logins_insert_admin_only" on client_logins
  for insert to authenticated
  with check (coalesce((select role = 'admin' from team_members where id = auth.uid()), false));

drop policy if exists "client_logins_update_admin_only" on client_logins;
create policy "client_logins_update_admin_only" on client_logins
  for update to authenticated
  using (coalesce((select role = 'admin' from team_members where id = auth.uid()), false))
  with check (coalesce((select role = 'admin' from team_members where id = auth.uid()), false));

drop policy if exists "client_logins_delete_admin_only" on client_logins;
create policy "client_logins_delete_admin_only" on client_logins
  for delete to authenticated
  using (coalesce((select role = 'admin' from team_members where id = auth.uid()), false));
