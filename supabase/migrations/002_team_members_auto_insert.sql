-- ============================================================
-- Auto-insert into team_members when a new auth user is created
-- Role defaults to 'member' — set to 'admin' manually after
-- ============================================================

create or replace function handle_new_auth_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.team_members (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    'member'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();
