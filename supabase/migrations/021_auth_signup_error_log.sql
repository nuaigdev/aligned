-- ============================================================
-- Aligned — Migration 021
-- Capture the real handle_new_auth_user() failure instead of just
-- warning into Postgres logs
--
-- Migration 020 stopped a broken team_members insert from blocking
-- signup, but only surfaced the cause via RAISE WARNING — invisible
-- unless someone goes digging in dashboard logs at the right moment.
-- This logs it into a real table instead so it can be queried like
-- any other data, which is how we actually found the root cause of
-- two separate "this new account doesn't work" reports.
-- ============================================================

create table if not exists auth_signup_trigger_errors (
  id             uuid primary key default gen_random_uuid(),
  auth_user_id   uuid,
  email          text,
  error_message  text,
  created_at     timestamptz not null default now()
);

alter table auth_signup_trigger_errors enable row level security;

drop policy if exists "Admins read signup errors" on auth_signup_trigger_errors;
create policy "Admins read signup errors"
  on auth_signup_trigger_errors for select
  to authenticated
  using (coalesce((select role = 'admin' from team_members where id = auth.uid()), false));

create or replace function handle_new_auth_user()
returns trigger language plpgsql security definer as $$
begin
  begin
    insert into public.team_members (id, name, email, role)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
      new.email,
      'member'
    )
    on conflict (id) do nothing;
  exception when others then
    insert into public.auth_signup_trigger_errors (auth_user_id, email, error_message)
    values (new.id, new.email, sqlerrm);
  end;
  return new;
end;
$$;
