-- ============================================================
-- Aligned — Migration 034
-- Freeze ticket_type for client-raised tickets
--
-- A ticket a client raised themselves (created_by_client_name is
-- set — see the dual-authorship CHECK from migration 006) must stay
-- a 'client' ticket forever; there's no scenario where something a
-- client explicitly submitted should later become invisible to
-- them. A ticket the team raised, on the other hand, can be
-- reclassified freely in either direction — 'client' <-> 'internal'
-- — since a NuAIg team member chose the classification and can
-- change their mind.
--
-- This is enforced at the DB layer (not just the Server Action in
-- lib/tickets/team-actions.ts) so the rule holds even against a
-- direct service-role write, the same defense-in-depth reasoning as
-- migration 033's comment-visibility trigger.
-- ============================================================

create or replace function enforce_client_raised_ticket_type()
returns trigger language plpgsql as $$
begin
  if new.ticket_type = 'internal' and new.created_by_client_name is not null then
    raise exception 'A ticket raised by the client can only ever be a client ticket.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tickets_freeze_client_raised_type on tickets;
create trigger trg_tickets_freeze_client_raised_type
  before insert or update of ticket_type on tickets
  for each row execute function enforce_client_raised_ticket_type();
