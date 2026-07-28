-- ============================================================
-- Aligned — Migration 020
-- Make the auth-signup → team_members trigger resilient
--
-- handle_new_auth_user() (migration 002) runs AFTER INSERT ON
-- auth.users, inside Supabase Auth's own signup transaction. Any
-- unhandled exception in that trigger aborts the whole signup —
-- GoTrue reports it back only as a generic 500 "Database error
-- creating new user", with the real cause visible solely in the
-- project's Postgres logs. A profile-sync side effect should never
-- be able to block someone from signing up at all, so this wraps
-- the insert in its own exception handler: on failure it logs a
-- warning and lets the auth.users row commit anyway. The app's
-- bootstrap script (scripts/create-admin-user.mjs) independently
-- checks for and repairs a missing team_members row, so this is
-- belt-and-suspenders, not the only safety net.
-- ============================================================

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
    raise warning 'handle_new_auth_user: could not create team_members row for % (%): %', new.id, new.email, sqlerrm;
  end;
  return new;
end;
$$;
