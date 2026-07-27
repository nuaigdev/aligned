-- ============================================================
-- Aligned — Migration 009
-- @-mentions on ticket comments
--
-- Direct port of Chronos migration 026. Mentions are restricted to
-- people on the client's team (the same is_on_client_team()
-- predicate from migration 006) — a BEFORE INSERT/UPDATE trigger
-- strips any id that isn't, so it's enforced at the database even
-- if the composer's UI is bypassed. Clients aren't individually
-- addressable under the shared-login model, so only team members
-- can be mentioned.
-- ============================================================

alter table ticket_comments
  add column if not exists mentioned_team_member_ids uuid[] not null default '{}';

create or replace function filter_ticket_comment_mentions()
returns trigger language plpgsql security definer as $$
begin
  if new.mentioned_team_member_ids is null then
    new.mentioned_team_member_ids := '{}';
    return new;
  end if;

  new.mentioned_team_member_ids := array(
    select distinct m
    from unnest(new.mentioned_team_member_ids) as m
    where is_on_client_team(get_ticket_client(new.ticket_id), m)
  );
  return new;
end;
$$;

drop trigger if exists trg_filter_ticket_comment_mentions on ticket_comments;
create trigger trg_filter_ticket_comment_mentions
  before insert or update of mentioned_team_member_ids on ticket_comments
  for each row execute function filter_ticket_comment_mentions();
