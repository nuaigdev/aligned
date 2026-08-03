-- ============================================================
-- Aligned — Migration 039
-- Ticket search — a real ranked search function instead of the
-- header dropdown doing an exact-int ref lookup plus a separate
-- title ILIKE round trip.
--
-- The old approach (lib/tickets/team-actions.ts searchTickets)
-- stripped everything but digits out of the query and did an exact
-- `ref_number = <int>` match — so a client-code query like "MATH"
-- or "math" (no digits) never matched a ref at all, "17" only ever
-- found ref_number exactly 17 (no prefix matching, so "1" never
-- surfaced 10-19/100-199), and there was no way to type the actual
-- displayed ticket key ("MATH-017") and get a match.
--
-- This mirrors formatTicketRef()'s `CODE-017` shape (lib/utils):
-- the client code is the first 4 letters of the client's slug with
-- hyphens stripped, uppercased; the number is displayed zero-padded
-- to 3 digits. A query is split into an optional letters prefix and
-- an optional digits prefix (leading zeros stripped, since "17" and
-- "017" must mean the same ticket), each matched as a *prefix* —
-- not equality — so "math", "MATH-017", "math17", and "17" all
-- resolve correctly, case-insensitively. Ticket-identifier matches
-- always rank above a plain title/content match, and an exact
-- identifier match ranks above a partial one.
-- ============================================================

-- Enables fast, index-backed substring matching for the title
-- fallback (a leading-wildcard ILIKE can't use a plain btree index).
create extension if not exists pg_trgm;

create index if not exists idx_tickets_title_trgm
  on tickets using gin (title gin_trgm_ops);

-- Backs prefix search on the ticket number's own text form ("17" as
-- a prefix of "170", "1700", etc.) with an actual index instead of a
-- full scan.
create index if not exists idx_tickets_ref_text
  on tickets ((ref_number::text) text_pattern_ops);

create or replace function search_tickets(p_query text, p_limit int default 8)
returns table (
  id uuid,
  ref_number int,
  title text,
  client_name text,
  client_slug text
)
language plpgsql
stable
as $$
declare
  v_trimmed text := trim(p_query);
  v_cleaned text := regexp_replace(v_trimmed, '[\s#]', '', 'g');
  v_letters text := '';
  v_digits text := '';
  v_is_ref_like boolean;
begin
  if v_trimmed = '' then
    return;
  end if;

  -- A "ref-like" query is only letters/digits with an optional single
  -- hyphen (e.g. "MATH-017", "math17", "17"). Anything else (spaces,
  -- other punctuation) skips identifier matching and falls straight
  -- through to the title search below.
  v_is_ref_like := v_cleaned <> '' and v_cleaned ~ '^[A-Za-z]*-?[0-9]*$';

  if v_is_ref_like then
    v_letters := upper(coalesce((regexp_match(v_cleaned, '^([A-Za-z]*)'))[1], ''));
    v_digits := ltrim(coalesce((regexp_match(v_cleaned, '([0-9]*)$'))[1], ''), '0');
    v_is_ref_like := v_letters <> '' or v_digits <> '';
  end if;

  return query
  select t.id, t.ref_number, t.title, c.name, c.slug
  from tickets t
  join clients c on c.id = t.client_id
  where
    (
      v_is_ref_like
      and (v_letters = '' or upper(left(replace(c.slug, '-', ''), 4)) like v_letters || '%')
      and (v_digits = '' or t.ref_number::text like v_digits || '%')
    )
    or t.title ilike '%' || v_trimmed || '%'
  order by
    case
      when v_is_ref_like
        and (v_letters = '' or upper(left(replace(c.slug, '-', ''), 4)) = v_letters)
        and (v_digits = '' or t.ref_number::text = v_digits)
        then 0
      when v_is_ref_like
        and (v_letters = '' or upper(left(replace(c.slug, '-', ''), 4)) like v_letters || '%')
        and (v_digits = '' or t.ref_number::text like v_digits || '%')
        then 1
      else 2
    end,
    t.updated_at desc
  limit p_limit;
end;
$$;
