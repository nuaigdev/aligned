-- ============================================================
-- Aligned — Migration 001
-- Extensions + shared helper functions
--
-- Everything downstream depends on this file. One extension
-- (pgcrypto) covers both UUID generation (gen_random_uuid, built
-- in to Postgres 13+ once the extension is loaded) and the random
-- tokens approval_links still needs — no separate uuid-ossp
-- dependency.
-- ============================================================

create extension if not exists "pgcrypto";

-- Shared updated_at trigger, reused by every table that has the column.
create or replace function handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
