# NuAIg Assist — CLAUDE.md

This file gives Claude Code full context to continue building NuAIg Assist
(formerly "Aligned" — renamed in place, same product/codebase).
Read this entirely before making any changes.

---

## What this product is

NuAIg Assist is an internal ticketing platform built by **NuAIg** for running client support
and requests. Clients log into a portal, raise tickets, and see them through to
resolution with their assigned project's team — all in one auditable thread instead of
scattered across email.

**The product is Ticketing, full stop.** NuAIg Assist previously also covered Milestones,
Decisions, a standalone project-level Documents panel, and an email-link approval/
sign-off flow. All of that has been removed — not paused, not redirected, actually
deleted from the codebase and torn down from the database (migration `040`). If you're
looking for that code, it's gone; don't resurrect it piecemeal without a real product
decision to bring the feature back, since the schema, RLS, routes, email templates, and
types were all deliberately removed together.

---

## Key design decisions (do not change without good reason)

### Access model — two distinct surfaces

| Surface | Who | How accessed |
|---|---|---|
| `/dashboard/*` | NuAIg team | Supabase Auth (email + password), login page at `/nuaig-login` |
| `/portal/*` | Client org | **Session login** — a client can have several independent named logins (`client_logins` table, migration 045), each its own login id + password, all seeing the same client-scoped data. The login page itself lives at the app root (`/`, `app/page.tsx` + `app/ClientLoginForm.tsx`), not under `/portal`. Session is a `jose`-signed JWT cookie carrying `{ clientId, clientLoginId }` — see `lib/auth/client-session*.ts` |

The client portal is reached via one of those named logins, not a per-project token —
there is no `portal_token` column. Login determines identity — see "Dual authorship"
below for how that replaced the old manual "posting as" picker. There's no portal tab
navigation: `/portal` is the sole hub, showing ticket scorecards + a "Your projects"
list; clicking a project goes to `/portal/projects/[projectId]`, which shows that
project's tickets. The one persistent "New ticket" button lives in the portal header
(`app/portal/(app)/layout.tsx`), not duplicated on individual pages. All of this is
gated by the session cookie (`middleware.ts`), not a token. There is no
`/portal/login` route at all — the login page is only ever `/`.

Because the client session is a custom JWT (not a Supabase Auth session), Postgres RLS
has no way to see it. Portal server actions/routes use `createServiceRoleClient()` —
authorization is a manual check in the action itself (a verified session's `clientId`,
and — since migration 045 — a live `client_logins.is_active` check so a revoked login
stops working mid-session, not just on next sign-in), not something RLS can enforce for
that surface. See rules 3–4 below.

### Ticket attachments — attribution only

A ticket comment/attachment can carry a `shared_by` tag (`'team'` or `'client'`) on the
`documents` row so the thread shows who attached what. `documents.ticket_id` is how a
ticket attachment hangs off this table; `documents.project_id` is optional (a ticket may
or may not have a project). There is no signing or approval workflow anywhere in the
product — nothing in NuAIg Assist requires a formal sign-off anymore.

### Ticketing — the heart of the app

Tickets are the entire product surface — clients log into the portal and raise them
(still an optional, un-forced project pick on that side); the assigned project's team
triages and works them.

Key departures from a plain kanban:

- **Dual authorship.** A ticket/comment is raised by exactly one of a
  `team_members` row OR a free-text `created_by_client_name` (there's no
  individual client account to foreign-key to — a client login is a
  credential in `client_logins`, not a user account) — enforced by a DB
  `CHECK` constraint (`tickets_single_author` / `ticket_comments_single_author`).
  As of migration 045, the client-side name is resolved server-side from
  whichever `client_logins` row authenticated the session
  (`requireActiveLoginName()` in `lib/tickets/portal-actions.ts`) — not typed
  by hand. There is no "posting as" picker anymore (`ContactNamePicker.tsx`
  and its `client_contacts`-backed name list were removed along with the
  single-shared-login model); the login itself is both the identity and the
  security boundary now.
- **`ticket_type`** (`'client' | 'internal'`, migration 033) — internal tickets
  are never shown on the client's portal and can only ever carry internal
  comments (enforced by a DB trigger, not just UI). A client-raised ticket is
  frozen to `'client'` forever (migration 034) — only team-raised tickets can
  be reclassified either direction.
- **Status** is richer than a 3-lane board on purpose: `open | in_progress |
  resolved | closed`, plus `reopened_count` (bumped by trigger).
- **`blocked_on`** (`'client' | 'team'`, nullable) flags who a ticket is waiting on.
- **Assignees are always team members** (`ticket_assignees`, multiple per
  ticket) — clients raise and watch, they don't get assigned.
- **Mentions** (`ticket_comments.mentioned_team_member_ids`) are restricted to
  people on the client's team (`is_on_client_team()`) — enforced by a filter
  trigger, not just the composer UI. This pool is intentionally wider than
  project membership (below) — mentioning isn't a security boundary the way
  acting on a ticket is.

**Project membership drives who can act on a ticket (migration 038,
`project_members` / `is_project_member` / `can_edit_ticket` /
`can_be_ticket_assignee`).** A project has an explicit team roster
(`project_members`, managed from the project hub's "Project team" panel by
anyone already on the project, the client's assigned Manager, or an admin — see
`ProjectMembersManager.tsx` / `lib/projects/members-actions.ts`). Being on a
project's team is what lets you comment on, change properties of, assign
people to, and attach files to that project's tickets — being a plain `member`
elsewhere in the org no longer grants any of that by itself. A client's
assigned Manager and admins keep full action rights across all of that
client's tickets regardless of explicit project membership (an intentional
override, not narrowed by this). `can_edit_ticket(ticket_id, user_id)` is the
single predicate for every ticket write surface (tickets UPDATE,
ticket_comments INSERT, ticket_assignees INSERT/DELETE, ticket-linked
`documents` INSERT/UPDATE/DELETE) — never re-implement it inline.

**Visibility is open, unlike action rights.** Any active team member can view
or search *any* ticket (`tickets`/`ticket_comments`/`ticket_assignees` SELECT
policies are simply `using (true)`, matching the "any team member, full
access" READ model every other table in this app already uses) — they just
can't act on one outside their own projects (read-only in the UI: no comment
composer, properties render as static pills, no upload/delete on attachments).
The dashboard's default Tickets list is still narrowed to "my projects" as a
**display filter** computed in `app/dashboard/tickets/page.tsx` (project
membership ∪ managed clients ∪ tickets you raised or are assigned to) — not an
RLS restriction — precisely so the universal ticket search can still open
anything outside that set. The dashboard Overview page (`app/dashboard/page.tsx`)
applies the identical scoping to its own ticket-derived sections, and
`app/dashboard/projects/page.tsx` applies the analogous scoping to the
Projects list (`lib/projects/scope.ts`) — same "display filter, not RLS"
pattern, kept in one shared helper so it can't drift between the two pages.

**Universal ticket search** lives in the dashboard header
(`components/dashboard/TicketSearch.tsx`, not on the Tickets page itself —
it's reachable from any dashboard route), backed by the `search_tickets()`
Postgres function (migration 039) via `searchTickets()` in
`lib/tickets/team-actions.ts`. It matches a client's short code and/or ticket
number as a case-insensitive prefix (so "math", "MATH-017", and "17" all
resolve to the right ticket), ranks an exact identifier match above a partial
one above a plain title match, and shows a dropdown of ref + title,
keyboard-navigable.

**Ticket creation requires a project** on the dashboard side — the picker in
`NewTicketModal.tsx` only offers the team member's own projects (or every
project, for an admin/a client's Manager); `client_id` is derived from the
chosen project, never trusted from the client directly. The portal's own
ticket form is unaffected and keeps its existing optional project picker —
this was an explicit, separate product decision; don't collapse the two
flows together.

**This whole model (project-scoped tickets, open ticket visibility) is
deliberately not extended to clients/projects** — those keep the original
"any team member, full access" RLS policies; only the *display* is scoped for
projects (see above), not the underlying access control. Don't copy the
ticket RLS pattern onto those tables without discussing it first; it's a real
behavior change.

**Notifications split by principal type:**
- Team side: real in-app notifications (`notifications` table + Supabase
  Realtime + the bell in `Sidebar.tsx`/`useNotifications.tsx`), because team
  members have real Supabase Auth sessions.
- Client side: email (`lib/email/index.ts`) is the primary channel — ticket
  confirmation (including when a team member logs a client-visible ticket on
  the client's behalf, or reclassifies one from internal to client),
  team reply, resolved, and closed-without-ever-being-resolved (see below).
  There's also a lightweight `client_notifications`-backed bell in the
  portal header (`PortalNotificationBell.tsx`), polled rather than
  Realtime-driven since a client login isn't a Supabase Auth session.
  Every ticket email is sent as one personalized send per recipient (never
  a shared multi-`to` send) to the ticket's effective contact list
  (`getTicketContactRecipients`, see Contact management below) plus a copy
  to the client's assigned Manager (`getManagerContact`/`withManagerCopy`,
  `lib/tickets/contacts.ts`). Every attempted send is logged to
  `ticket_emails` (migration 041), which also backs an idempotency guard —
  confirmation/resolved/closed each check for a recent send of the same
  kind on the same ticket before firing again; reply is deliberately not
  guarded that way, since two distinct replies close together are
  legitimate. Nothing is logged and no DB round trip happens when
  `RESEND_API_KEY` is unset — see rule 11.
- **Closed without ever being resolved**: `sync_ticket_status_timestamps`
  (migration 006) sets `resolved_at`/`closed_at` independently, so a ticket
  can go straight from open/in_progress to closed without ever passing
  through resolved. `updateTicket()` sends the "closed" email only in that
  specific case (`resolved_at` was still null) — if it went through
  resolved first, the client already got that email and a second one would
  be noise.
- There is **no non-production guard** on any of this — a deliberate
  product decision. The moment `RESEND_API_KEY` is set in an environment,
  that environment sends real email to real client contacts. Treat the key
  as live everywhere you put it, including local dev and preview deploys.

### Team roles & hierarchy

`team_members.role` is a real enum: `admin | manager | member` (not the old
unchecked free-text column). `team_members.manager_id` is a self-referential
"reports to" — the direct analogue of `clients.manager_id`. "A Manager's team"
means `team_members where manager_id = <that manager's id>`. A trigger
(`validate_team_member_manager` / `validate_client_manager`) enforces that
whoever is set as a manager actually holds the `admin` or `manager` role.

### Mobile — blocked entirely

The platform displays a "Desktop only" message on viewports below 768px.
This applies to ALL routes including the portal. Do not remove the mobile
block from `app/layout.tsx`.

### Contact management

Contacts exist at two levels:
1. **Client level** (`project_id = null`) — default contacts inherited by all projects
2. **Project level** (`project_id = <id>`) — additions for a specific project

`client_contacts` now serves one purpose only: the recipient list for ticket
email (`lib/email/index.ts`). It is no longer read for portal identity —
that's `client_logins` now (see Access model and Dual authorship above).
When resolving who should be emailed about a ticket, use the project's
*effective* contact list (client defaults + project-specific additions for
that ticket's project) — not just the client-level defaults.

### Client logins vs. client contacts — don't conflate these

Two separate tables with two separate jobs:
- **`client_logins`** (migration 045) — who can sign into the portal. Each row
  is a real credential (login id + password hash), admin-managed from the
  client detail page's "Manager & portal access" panel
  (`ClientAccessManager.tsx` / `lib/clients/access-actions.ts`). This is the
  security boundary, and also now supplies the display name attached to
  whatever that login authors.
- **`client_contacts`** — who gets emailed about a ticket. Not a login, not
  a security boundary, just an address book.

A client contact does not automatically get a portal login, and a portal
login's `contact_name` isn't synced from `client_contacts` — they're
independently managed on the same client detail page.

---

## Tech stack

| Layer | Tool | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router) | Server Components where possible |
| Database | Supabase (PostgreSQL) | See migration file |
| Auth | Supabase Auth | Team only — clients don't have accounts |
| Storage | Supabase Storage | Bucket: `project-documents` |
| Email | Resend | Ticket confirmation/reply/resolved/closed, personalized per recipient, logged to `ticket_emails` — see `lib/email/index.ts` |
| Deployment | Vercel | Free tier |
| Styling | Tailwind CSS + inline styles | See design system below. The codebase's real convention is **inline `style={{}}` everywhere** — the `.card`/`.pill`/`.btn` utility classes in `globals.css` exist but aren't actually used by any component; match the inline-style convention, not the unused classes. |
| Client auth | `bcryptjs` + `jose` | `lib/auth/client-session*.ts` — portal login, NOT Supabase Auth (see Access model) |
| Motion/feedback | `framer-motion` + `react-hot-toast` | Page/tab transitions (`template.tsx` files), optimistic UI, toasts — see "Motion & polish" note below |

---

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   ← never expose to client
RESEND_API_KEY=
RESEND_FROM_EMAIL=
RESEND_FROM_NAME=NuAIg Assist
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_COMPANY_NAME=NuAIg
NEXTAUTH_SECRET=              ← signs the client portal session JWT (lib/auth/client-session-core.ts) — required, not decorative
```

---

## Database setup

The migrations folder is one clean, dependency-ordered sequence: `001` built the
original schema (team/roles → clients/login → projects → tickets → notifications/
settings → RLS → storage), and `020`–`045` are incremental changes on top of it
(RBAC tightening, ticket types, project membership, ticket search, removing the
Milestones/Decisions/Approvals schema the product no longer has as of `040`, a
ticket email audit/idempotency log as of `041`, and the single shared client login
replaced by multiple independent named `client_logins` as of `045`).
Chronos's conventions are followed throughout: `CREATE TABLE IF NOT EXISTS`, `DROP
POLICY IF EXISTS` before every `CREATE POLICY`, enum creation wrapped in `DO $$ ...
EXCEPTION WHEN duplicate_object`, one `SECURITY DEFINER STABLE` helper per reusable RLS
predicate. This assumes a **fresh Supabase project** — there is no migration path from
the old schema, and none is needed (no prior production data to preserve).

Run `supabase/migrations/001` through `045` **in order** in the Supabase SQL
editor (or via the CLI). The storage bucket (`project-documents`) and its access
policies are created **live by migration `019`** — no manual dashboard step needed.
(Migration `019` also created a `signed-records` bucket for a PDF export that was
never built; migration `040` removes it along with the rest of the approval flow.)

Then create your first team member (this one step still has to be manual —
Supabase Auth signup isn't scriptable from a migration):
1. Sign up via Supabase Auth dashboard (Authentication > Users > Add user)
2. Copy the generated UUID — the `handle_new_auth_user` trigger (migration
   `002`) auto-inserts a `team_members` row for it with `role = 'member'`
3. Promote them to admin: `UPDATE team_members SET role = 'admin' WHERE id = 'uuid-here';`

To issue a client's portal login(s), use the "Manager & portal access" panel on
that client's dashboard page (`app/dashboard/clients/[clientId]/ClientAccessManager.tsx`)
— each named login gets its own login id + one-time password, generated
server-side (`lib/clients/access-actions.ts`), never in the browser. A client
can have any number of these (e.g. one per contact); each is independent and
all see the same client-scoped portal data.

---

## Project structure

```
app/
  page.tsx                ← Client login — the canonical URL, not under /portal
  ClientLoginForm.tsx      ← Client login form + marketing panel ('use client')
  login-actions.ts        ← Server Actions: loginClient / logoutClient (client_logins-backed)
  nuaig-login/             ← Team login (Supabase Auth) + marketing panel
    page.tsx

  dashboard/              ← NuAIg team views (Supabase Auth required)
    page.tsx              ← Overview / home — stat tiles, "needs your attention",
                             assigned-to-me, ticket-status meter, activity stream
    layout.tsx             ← Sidebar layout + NotificationsProvider
    template.tsx            ← Page-transition wrapper (framer-motion)
    tickets/                ← Ticket board (kanban+list), new-ticket modal, ticket-# search
      page.tsx / TicketsBoard.tsx / TicketCard.tsx / NewTicketModal.tsx
      [id]/                  ← Ticket detail + comments (read-only when !canAct)
        page.tsx / TicketDetail.tsx / TicketComments.tsx / TicketPropertiesPanel.tsx / TicketAttachments.tsx
    clients/                 ← Client list + client detail
      [clientId]/
        ContactsManager.tsx       ← Client contacts (email recipients, not portal logins)
        ClientAccessManager.tsx  ← Manager picker + multi-login management (client_logins)
    projects/
      [projectId]/
        page.tsx                   ← Project hub: ticket stats + team + embedded board
        ProjectMembersManager.tsx  ← Project team add/remove

  portal/
    (app)/                ← Route group requiring a valid client session
      layout.tsx          ← Topbar (Logo→/portal, New ticket, bell, logout, "Signed in as {loginName}")
      template.tsx        ← Page-transition wrapper
      page.tsx            ← Client hub: ticket scorecards + projects list
      tickets/            ← List / new / detail — author name comes from the session, no name picker
      projects/[projectId]/  ← That project's ticket list

  (no api/ directory — every mutation is a Server Action; there are no route handlers today)

components/
  AuthMarketingPanel.tsx  ← Shared split-screen marketing panel (used by / and /nuaig-login)
  dashboard/
    Header.tsx            ← Top nav (Overview/Tickets/Projects/Clients[/Team]) + TicketSearch + NotificationBell
    TicketSearch.tsx      ← Universal ticket search dropdown (header, not the Tickets page)
    NotificationBell.tsx  ← In-app notification dropdown

hooks/
  useNotifications.tsx    ← Realtime-subscribed notification context (team side)

lib/
  supabase/               ← Browser, server, and service role clients
  auth/
    client-session-core.ts   ← jose-only session sign/verify (Edge-safe, used by middleware.ts) — payload is { clientId, clientLoginId }
    client-session.ts        ← + bcryptjs password hashing (Node-only, Server Actions only)
    client-session-cookies.ts ← next/headers cookie wrapper
  portal/session-guard.ts  ← requireClientSession / getSessionClient (merges clients + client_logins) / getSessionProject
  tickets/
    team-actions.ts        ← Server Actions: dashboard-side ticket CRUD (RLS-governed), searchTickets
    portal-actions.ts      ← Server Actions: client-side ticket create/comment (service role + manual client_id + client_logins.is_active checks)
    contacts.ts             ← getTicketContactRecipients / getManagerContact / withManagerCopy — shared ticket-email recipient resolution
  projects/
    actions.ts             ← createProject (auto-adds creator as first project_member) / deleteProject
    members-actions.ts     ← addProjectMember / removeProjectMember (RLS: can_manage_project_members)
    scope.ts                ← getMyProjectScope / scopeProjectsQuery — shared "my projects" display filter (Overview + Projects list)
  clients/access-actions.ts  ← Manager assignment + per-login credential create/reset/revoke (client_logins)
  notifications/create.ts   ← createTicketNotifications / getActorName / createClientNotification
  email/index.ts          ← Resend helpers (ticket confirmation/reply/resolved) — lazy client, no-ops if RESEND_API_KEY unset
  utils/index.ts           ← Formatting, helpers, ticket status/priority config

types/index.ts            ← All TypeScript types (mirrors DB schema)
middleware.ts             ← Auth guard for /dashboard (Supabase session, login at /nuaig-login) AND /portal (client session JWT, login at /)
```

---

## What is built vs TODO

### Built
- [x] Database schema — full rebuild, `001`–`041`, fresh-project ready (see Database setup)
- [x] TypeScript types
- [x] Supabase client helpers (browser, server, service role)
- [x] Team auth middleware (Supabase Auth) + client portal session middleware (JWT)
- [x] Mobile block
- [x] Team login page
- [x] Client portal login (session-based, canonical URL is `/`) — multiple independent named logins per client (`client_logins`, migration 045)
- [x] Dashboard layout + sidebar (incl. Tickets nav + notification bell)
- [x] Dashboard overview page
- [x] Clients list + client detail (contacts, Manager picker, portal login issuance)
- [x] Projects list + new-project form + project detail page (hub)
- [x] Client portal hub (session-based) — Tickets + Projects
- [x] Tickets: schema, RLS (project-membership action scoping, open visibility), dashboard
      board/list + detail, portal create/list/detail, comments w/ @mentions, universal
      ranked search, in-app + email notifications
- [x] Email templates (ticket confirmation/reply/resolved)
- [x] Motion/feedback polish: page transitions, optimistic UI, toasts, loading skeletons

### TODO
- [ ] Real-time updates on the client portal (currently Server Action + `revalidatePath`, not Supabase Realtime — the client session isn't a Supabase Auth principal, so Realtime's RLS-gated subscriptions don't apply there)
- [ ] Ticket email delivery webhooks (Resend bounce/complaint → `ticket_emails.status`, auto-flag a bouncing contact inactive) — deferred, not forgotten. There is deliberately **no** non-production send guard (explicit product decision) — every environment sends real email the moment `RESEND_API_KEY` is set, so treat that key as live in every environment you put it in.

---

## Design system

The UI matches the mockups designed in the planning phase. Key rules:

**Colors**
- Brand purple: `#534AB7` (primary actions, active nav, links)
- Brand light: `#EEEDFE` (backgrounds, pills)
- Success: green `#3B6D11` / `#EAF3DE`
- Warning: amber `#633806` / `#FAEEDA`
- Danger: red `#A32D2D` / `#FCEBEB`
- Info: blue `#0C447C` / `#E6F1FB`
- Page bg: `#F1EFE8`
- Card bg: `#ffffff`
- Border: `rgba(0,0,0,0.1)` (0.5px)

**Typography**
- Font: Geist Sans (loaded via `geist` package)
- Body: 13-14px
- Labels/meta: 11-12px
- Page titles: 22px, weight 500
- No 600 or 700 weight — use 500 for bold

**Components**
- Cards: white bg, `border: 0.5px solid rgba(0,0,0,0.1)`, `border-radius: 10px`
- Pills/badges: 10px text, 2px/8px padding, 10px border-radius
- Buttons: brand purple for primary, light border for secondary
- No shadows, no gradients on UI chrome

**Layout**
- Dashboard: fixed sidebar (220px) + scrollable main
- Portal: centered column, max-width 860px
- Consistent 24px page padding

---

## Pill status reference (use consistently)

| State | Background | Text color |
|---|---|---|
| Completed / Signed | `#EAF3DE` | `#3B6D11` |
| Awaiting / Pending | `#FAEEDA` | `#633806` |
| Internal | `#F1EFE8` | `#888780` |
| Info / Notified | `#E6F1FB` | `#0C447C` |
| Not started | `#F1EFE8` | `#888780` |
| Ticket: Open | `#E6F1FB` | `#0C447C` |
| Ticket: In progress | `#FAEEDA` | `#633806` |
| Ticket: Resolved | `#EAF3DE` | `#3B6D11` |
| Ticket: Closed | `#F1EFE8` | `#888780` |

(`TICKET_STATUS_CONFIG` / `TICKET_PRIORITY_COLOR` in `lib/utils/index.ts` are the
canonical source for these — use them rather than re-declaring the mapping.)

---

## Important rules for Claude Code

1. **Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client.** It is used only in
   API routes and server-only code. Always check before adding it to any client component.

2. **Portal routes/actions use the service role client** (to bypass RLS —
   the client's session is a custom JWT, not a Supabase Auth session, so RLS
   can't see it anyway). Dashboard routes use the authenticated server client,
   which lets Postgres RLS do the access control (important for tickets —
   see the Ticketing section).

3. **The portal has auth** (client login — see Access model) but it's still not
   Supabase Auth, and RLS still isn't the enforcement layer for it.

4. **Always use `createServiceRoleClient()` in API routes/Server Actions that
   run under the portal session**, since it isn't a Supabase Auth principal RLS
   can evaluate. Authorization for those is a manual check in the action itself
   (e.g. `lib/portal/session-guard.ts`, `lib/tickets/portal-actions.ts` checking
   `ticket.client_id === session.clientId`) — don't skip that check because
   "the query is scoped to an id" isn't enough when the client bypasses RLS.

5. **Use Server Components by default.** Only add `'use client'` when you need
   interactivity (forms, onClick, useState, etc.).

6. **Document uploads go to Supabase Storage** `project-documents` bucket.
   The portal side uploads via a service-role Server Action
   (`uploadPortalAttachment` in `lib/tickets/portal-actions.ts`, per rule 4 above);
   the dashboard side (`TicketAttachments.tsx`) uploads directly from the browser
   with the authenticated client, relying on `documents`' RLS (`can_edit_ticket`
   for ticket-linked rows). Either way, store the `storage_path` in the
   `documents` table and generate signed URLs on the fly for downloads (1hr expiry).

7. **Company name is NuAIg.** In all UI copy, emails, and labels, use "NuAIg" not
   "Momentum Studio" or any placeholder. The client's company name comes from the
   `clients.name` field in the database.

8. **Ticket visibility is a real access-control feature, not just a UI filter.**
   `can_view_ticket()` / `is_on_client_team()` (migration `006`/`010`) are the
   single source of truth for "can this team member see/act on this ticket."
   Never re-implement that predicate inline in a query or a new RLS policy —
   call the existing SQL function, the same way `ticket_comments` and
   `ticket_assignees` both call it rather than each getting their own copy.
   If the rule ever needs to change, it changes in exactly one place.

9. **A ticket/comment's author is exactly one of `created_by_team_member_id`
   OR `created_by_client_name`**, enforced by a DB `CHECK` constraint. When
   writing a new query or UI against `tickets`/`ticket_comments`, always
   handle both — don't assume every row has a team-member author.

10. **New migrations continue the `NNN_description.sql` sequence** (currently
    through `045`) — one concern per file, idempotent (`IF NOT EXISTS`,
    `DROP POLICY IF EXISTS` before `CREATE POLICY`), and any RLS predicate
    used by more than one table extracted into its own `SECURITY DEFINER
    STABLE` SQL function first. Don't go back and edit an already-numbered
    migration file once it's part of the sequence — add a new one.

11. **`lib/email/index.ts`'s Resend client is lazy and no-ops without
    `RESEND_API_KEY`.** Don't reintroduce `new Resend(...)` at module scope —
    that crashes the Next.js build's page-data-collection step the moment any
    server action importing this file gets analyzed with the key unset.

12. **`lib/auth/client-session-core.ts` must stay bcryptjs-free.** It's the
    only auth file `middleware.ts` may import (Edge runtime — `bcryptjs`
    depends on Node's `crypto` and isn't Edge-compatible). Password hashing
    lives in `lib/auth/client-session.ts`, imported only from Server Actions.

13. **Motion and feedback are load-bearing UX requirements here, not
    decoration** — every dashboard/portal route transition goes through a
    `template.tsx` (framer-motion), every mutation gives `react-hot-toast`
    feedback, and ticket status/assignee/comment changes update local state
    optimistically before the server round-trip resolves. When adding a new
    mutating action, follow that pattern rather than a plain
    `await action(); router.refresh()`.

14. **Milestones, Decisions, and the email-link approval/sign-off flow are
    gone, not paused.** The routes, Server Actions, DB tables/types/functions,
    and email templates were deliberately deleted together (see migration
    `040`). If a future request wants any of that back, treat it as new
    product work — design it against the current schema (project membership,
    ticket-centric notifications) rather than resurrecting the old files from
    git history, which predate decisions like the client session model and
    would need real reconciliation, not a revert.
