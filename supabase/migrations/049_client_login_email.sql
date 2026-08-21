-- ============================================================
-- NuAIg Assist — Migration 049
-- A portal login IS an email address
--
-- Until now `client_logins.login_id` was an arbitrary slug
-- ("nexus-co-jane") and the ticket-email recipient list came from a
-- second, separately managed table (`client_contacts`). The two lists
-- drifted: a person could hold a portal login and receive no email
-- about their own tickets, or receive email while having no way to
-- sign in and reply.
--
-- From here, `login_id` holds the person's email address, which makes
-- `client_logins` the single source of truth for both "who can sign
-- in" and "who gets told about a ticket". The column keeps its name
-- and its UNIQUE constraint — this is a semantic change plus a format
-- CHECK, not a reshape, so nothing downstream of the unique index has
-- to move.
--
-- The CHECK is added NOT VALID on purpose: it enforces the format on
-- every INSERT and UPDATE from now on while leaving any pre-existing
-- slug logins readable, so this migration can't fail on a database
-- that already has logins in it. Those legacy logins keep working for
-- sign-in but will never receive email (there's no address to send
-- to) — reissue them from the client's "Manager & portal access"
-- panel, which now takes an email. Once none remain, the constraint
-- can be promoted with:
--   alter table client_logins validate constraint client_logins_login_id_is_email;
--
-- `client_contacts` is deliberately left in place but is no longer
-- read by anything: the app-side panel and the email recipient
-- resolution both moved to client_logins in this same change. It is
-- kept only so the addresses it holds can still be looked up while
-- logins are issued for the people who need them. Dropping it is a
-- separate, explicit decision.
-- ============================================================

alter table client_logins
  drop constraint if exists client_logins_login_id_is_email;

alter table client_logins
  add constraint client_logins_login_id_is_email
  check (login_id ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
  not valid;

comment on column client_logins.login_id is
  'The person''s email address, lowercased. Doubles as their portal sign-in ID and the address every ticket email for this client is sent to (migration 049).';

comment on table client_contacts is
  'DEPRECATED as of migration 049 — no longer read by the application. Ticket email recipients now come from client_logins.login_id.';
