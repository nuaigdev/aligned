-- ============================================================
-- Aligned — Migration 017
-- App settings
--
-- Single-tenant version of Chronos's admin_settings (Aligned is
-- one company, NuAIg — no company_id scoping needed). Simple
-- key/value config, value always shaped as { "value": <json> } to
-- match Chronos's convention.
-- ============================================================

create table if not exists app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

drop trigger if exists app_settings_updated_at on app_settings;
create trigger app_settings_updated_at
  before update on app_settings
  for each row execute function handle_updated_at();

insert into app_settings (key, value) values
  ('ticket_client_can_set_priority', '{"value": true}'::jsonb),
  ('ticket_categories', '{"value": ["bug", "feature_request", "question", "billing", "general"]}'::jsonb),
  ('ticket_archive_closed_days', '{"value": 30}'::jsonb)
on conflict (key) do nothing;

alter table app_settings enable row level security;

drop policy if exists "Team members read settings" on app_settings;
drop policy if exists "Admins manage settings"      on app_settings;

create policy "Team members read settings"
  on app_settings for select
  to authenticated
  using (true);

create policy "Admins manage settings"
  on app_settings for all
  to authenticated
  using (coalesce((select role = 'admin' from team_members where id = auth.uid()), false))
  with check (coalesce((select role = 'admin' from team_members where id = auth.uid()), false));

grant select, insert, update, delete on app_settings to authenticated;
