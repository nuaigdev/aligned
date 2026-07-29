-- ============================================================
-- Aligned — Migration 033
-- Ticket types — Client tickets vs Internal tickets
--
-- Every ticket still belongs to a client_id (unchanged scope from
-- migration 006), but a ticket can now be marked 'internal' —
-- raised by the team, about a client, but never shown to that
-- client. 'client' (the default) is the existing behavior: visible
-- on that client's portal.
--
-- The portal enforces the client-facing half of this in application
-- code (createServiceRoleClient() bypasses RLS, same as every other
-- portal query — see CLAUDE.md rules 3/4), not RLS, since the
-- client session isn't a Postgres role. The trigger below is the
-- one piece that *is* enforced at the DB layer: an internal ticket's
-- comments can never be flagged visible_to_client, regardless of
-- what a dashboard composer sends, so a ticket that starts as
-- 'client' and gets reclassified 'internal' can't leave a stale
-- client-visible comment around that would matter if it flipped
-- back.
-- ============================================================

alter table tickets
  add column if not exists ticket_type text not null default 'client'
  check (ticket_type in ('client', 'internal'));

create index if not exists idx_tickets_ticket_type on tickets(ticket_type);

create or replace function enforce_internal_ticket_comment_visibility()
returns trigger language plpgsql as $$
begin
  if (select ticket_type from tickets where id = new.ticket_id) = 'internal' then
    new.visible_to_client := false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ticket_comments_internal_visibility on ticket_comments;
create trigger trg_ticket_comments_internal_visibility
  before insert or update of visible_to_client on ticket_comments
  for each row execute function enforce_internal_ticket_comment_visibility();
