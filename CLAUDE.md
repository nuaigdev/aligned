# Aligned — CLAUDE.md

This file gives Claude Code full context to continue building Aligned.
Read this entirely before making any changes.

---

## What this product is

Aligned is an internal project management platform built by **NuAIg** for managing
client projects. The core problem it solves: clients say "we never agreed to that" or
"we don't remember that decision." This platform creates an auditable, signed record of
every decision and milestone, with a read-only portal for clients.

**Current focus: Ticketing only.** The product is deliberately scoped down to
Clients → Projects → Tickets for now — Milestones, Decisions, and the standalone
project-level Documents panel are paused (routes redirect away, nav links removed)
while Ticketing is built out. None of that code was deleted; see "Paused features"
below for exactly what's off and how to bring it back.

---

## Key design decisions (do not change without good reason)

### Access model — three distinct surfaces

| Surface | Who | How accessed | Can sign? |
|---|---|---|---|
| `/dashboard/*` | NuAIg team | Supabase Auth (email + password) | N/A |
| `/portal/*` | Client org | **Session login** — one shared login id + password per client company (`clients.login_id`/`password_hash`, verified in `/portal/login`, session is a `jose`-signed JWT cookie — see `lib/auth/client-session*.ts`) | **No** |
| `/sign/[approvalToken]` | Named individual | One-time email link | **Yes** |

The old design reached the portal via an unguessable per-project `portal_token` URL.
That's retired — there is no `portal_token` column anymore. Login determines
identity; the client hub (`/portal`) currently lists just Tickets (the "Your
Projects" list and the `/portal/projects/[projectId]/...` drill-down —
milestones/decisions/documents — are paused, see "Paused features" below),
all gated by the session cookie (`middleware.ts`), not a token.

Signing is still **only** ever done via `/sign/[approvalToken]` — a one-time
email link to a named recipient. Clients cannot sign anything from the portal,
even though they can now log in, create tickets, and comment. This is
intentional and must not be changed.

Because the client session is a custom JWT (not a Supabase Auth session),
Postgres RLS has no way to see it. Portal server actions/routes keep using
`createServiceRoleClient()` exactly as before — what changed is *what's
checked* before that call (a verified session's `clientId`, instead of a
`portal_token` lookup). See rules 3–4 below.

### Documents — no signing, just attribution

Documents are tagged as shared **"By NuAIg"** or **"By [ClientName]"**.
There is no signing on documents. Formal approval happens at the milestone and
decision level, not on individual files. `documents.ticket_id` (nullable,
alongside `milestone_id`/`decision_id`) lets a ticket attachment reuse this
same vault.

### Ticketing — the heart of the app

Tickets are the primary surface now — clients log into the portal and raise
them (still an optional, un-forced project pick on that side); the assigned
project's team triages and works them.

Key departures from a plain kanban:

- **Dual authorship.** A ticket/comment is raised by exactly one of a
  `team_members` row OR a free-text `created_by_client_name` (the client login
  is one shared credential per company, not per person, so there's no
  individual client account to foreign-key to) — enforced by a DB `CHECK`
  constraint (`tickets_single_author` / `ticket_comments_single_author`).
  On the portal, the person's name is captured via a lightweight, non-auth
  "posting as" picker sourced from `client_contacts` (see
  `app/portal/(app)/tickets/ContactNamePicker.tsx`) — that's cosmetic
  attribution, not a security boundary; the login id is the boundary.
- **`ticket_type`** (`'client' | 'internal'`, migration 033) — internal tickets
  are never shown on the client's portal and can only ever carry internal
  comments (enforced by a DB trigger, not just UI). A client-raised ticket is
  frozen to `'client'` forever (migration 034) — only team-raised tickets can
  be reclassified either direction.
- **Status** is richer than a 3-lane board on purpose: `open | in_progress |
  resolved | closed`, plus `reopened_count` (bumped by trigger, not a full
  `parent_id`/iteration chain like milestones — tickets aren't formal
  contractual artifacts).
- **`blocked_on`** (`'client' | 'team'`, nullable) is the same concept as
  `milestones.delay_owner`, reused for visual/conceptual consistency between
  the two features.
- **Assignees are always team members** (`ticket_assignees`, multiple per
  ticket) — clients raise and watch, they don't get assigned.
- **Mentions** (`ticket_comments.mentioned_team_member_ids`) are restricted to
  people on the client's team (`is_on_client_team()`) — enforced by a filter
  trigger, not just the composer UI. This pool is intentionally wider than
  project membership (below) — mentioning isn't a security boundary the way
  acting on a ticket is.

**Project membership drives who can act on a ticket (migration 038,
`project_members` / `is_project_member` / `can_edit_ticket` /
`can_be_ticket_assignee`).** A project now has an explicit team roster
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
RLS restriction — precisely so the "jump to ticket #" search
(`findTicketByRef`) can still open anything outside that set. This
supersedes migration 037's narrower SELECT policy; that narrowing turned out
to conflict with wanting any ticket to be findable by number.

**Ticket creation requires a project** on the dashboard side — the picker in
`NewTicketModal.tsx` only offers the team member's own projects (or every
project, for an admin/a client's Manager); `client_id` is derived from the
chosen project, never trusted from the client directly. The portal's own
ticket form is unaffected and keeps its existing optional project picker —
this was an explicit, separate product decision; don't collapse the two
flows together.

**This whole model (project-scoped tickets, open ticket visibility) is
deliberately not extended to clients/projects/milestones/decisions/documents**
— those keep the original "any team member, full access" policies. Don't copy
the ticket RLS pattern onto those tables without discussing it first; it's a
real behavior change.

### Paused features — Milestones, Decisions, Documents (project-level)

Every panel, action, and migration for these still exists on disk, untouched
— they're switched off at the routing layer only, so re-enabling any of them
is a small, mechanical change with nothing to rebuild:

- **Dashboard**: `app/dashboard/projects/[projectId]/{milestones,decisions,documents}/page.tsx`
  each had their real logic renamed into an unused `*PageContent` function in
  the same file, with the actual default export reduced to a one-line
  `redirect(...)` back to the project hub. To re-enable one, replace that
  redirect with `return XPageContent({ params })` and re-add its quick-nav
  card on the project hub page (`app/dashboard/projects/[projectId]/page.tsx`,
  now ticket-stats-only).
- **Portal**: `app/portal/(app)/projects/[projectId]/layout.tsx` redirects to
  `/portal` before rendering anything below it (overview/milestones/
  decisions/documents pages are all untouched, just unreachable). Remove that
  redirect, re-add the "Projects" tab to `PortalNav.tsx`, and re-add the "Your
  projects" list + query to the portal hub (`app/portal/(app)/page.tsx`) to
  bring the whole drill-down back.
- Ticket attachments (`documents.ticket_id`) are **not** part of this pause —
  they're Ticketing, and keep working through `can_edit_ticket()` (migration
  038), independent of the standalone project-level Documents panel above.

**Notifications split by principal type:**
- Team side: real in-app notifications (`notifications` table + Supabase
  Realtime + the bell in `Sidebar.tsx`/`useNotifications.tsx`), because team
  members have real Supabase Auth sessions.
- Client side: email only (`lib/email/index.ts` — ticket confirmation, team
  reply, resolution), sent to the client's active `client_contacts`, because
  the shared login has no individual session to mark "read" against.

### Team roles & hierarchy

`team_members.role` is a real enum: `admin | manager | member` (not the old
unchecked free-text column). `team_members.manager_id` is a self-referential
"reports to" — the direct analogue of `clients.manager_id`. "A Manager's team"
means `team_members where manager_id = <that manager's id>`. A trigger
(`validate_team_member_manager` / `validate_client_manager`) enforces that
whoever is set as a manager actually holds the `admin` or `manager` role.

### Approval flow — first signer locks it

When multiple recipients receive approval links for the same decision/milestone,
the **first person to sign locks it**. All other pending links are marked `superseded`.
Others who open their link see who already signed, with timestamp.

### Mobile — blocked entirely

The platform displays a "Desktop only" message on viewports below 768px.
This applies to ALL routes including the portal and sign page.
Do not remove the mobile block from `app/layout.tsx`.

### Milestone types

- `client_gate` — requires client sign-off before project can proceed
- `internal` — NuAIg owns it, client can view but no action needed
- `informational` — auto-notifies client, no action

Regression (e.g. UAT fails, goes back to dev) is handled by re-opening a milestone
and incrementing `iteration`. The old iteration is kept in history with `parent_id`.
Do not delete milestone records — always create new iterations.

### Contact management

Contacts exist at two levels:
1. **Client level** (`project_id = null`) — default contacts inherited by all projects
2. **Project level** (`project_id = <id>`) — additions for a specific project

When sending approval links, always pick from the project's effective contact list
(client defaults + project-specific additions).

---

## Tech stack

| Layer | Tool | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router) | Server Components where possible |
| Database | Supabase (PostgreSQL) | See migration file |
| Auth | Supabase Auth | Team only — clients don't have accounts |
| Storage | Supabase Storage | Buckets: `project-documents`, `signed-records` |
| Email | Resend | See `lib/email/index.ts` |
| PDF | @react-pdf/renderer | For signed record generation (not yet built) |
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
RESEND_FROM_NAME=NuAIg Aligned
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_COMPANY_NAME=NuAIg
NEXTAUTH_SECRET=              ← signs the client portal session JWT (lib/auth/client-session-core.ts) — required, not decorative
CRON_SECRET=                 ← for nudge API route
```

---

## Database setup

The migrations folder was **fully rebuilt from `001`** as one clean,
dependency-ordered sequence (team/roles → clients/login → projects → tickets
→ milestones/decisions/approvals/documents → notifications/settings → RLS →
storage), following Chronos's conventions throughout: `CREATE TABLE IF NOT
EXISTS`, `DROP POLICY IF EXISTS` before every `CREATE POLICY`, enum creation
wrapped in `DO $$ ... EXCEPTION WHEN duplicate_object`, one `SECURITY DEFINER
STABLE` helper per reusable RLS predicate. This assumes a **fresh Supabase
project** — there is no migration path from the old schema, and none is
needed (no prior production data to preserve).

Run `supabase/migrations/001` through `019` **in order** in the Supabase SQL
editor (or via the CLI). Storage buckets (`project-documents`, `signed-records`)
and their access policies are created **live by migration `019`** — no manual
dashboard step needed for those anymore.

Then create your first team member (this one step still has to be manual —
Supabase Auth signup isn't scriptable from a migration):
1. Sign up via Supabase Auth dashboard (Authentication > Users > Add user)
2. Copy the generated UUID — the `handle_new_auth_user` trigger (migration
   `002`) auto-inserts a `team_members` row for it with `role = 'member'`
3. Promote them to admin: `UPDATE team_members SET role = 'admin' WHERE id = 'uuid-here';`

To issue a client's portal login, use the "Manager & portal access" panel on
that client's dashboard page (`app/dashboard/clients/[clientId]/ClientAccessManager.tsx`)
— it generates a login id + one-time password server-side
(`lib/clients/access-actions.ts`), never in the browser.

---

## Project structure

```
app/
  dashboard/              ← NuAIg team views (Supabase Auth required)
    page.tsx              ← Overview / home
    layout.tsx            ← Sidebar layout + NotificationsProvider
    template.tsx          ← Page-transition wrapper (framer-motion)
    tickets/               ← Ticket board (kanban+list), new-ticket modal, ticket-# search
      page.tsx / TicketsBoard.tsx / TicketCard.tsx / NewTicketModal.tsx
      [id]/                ← Ticket detail + comments (read-only when !canAct)
        page.tsx / TicketDetail.tsx / TicketComments.tsx / TicketPropertiesPanel.tsx / TicketAttachments.tsx
    clients/               ← Client list + client detail
      [clientId]/
        ContactsManager.tsx       ← Client contacts
        ClientAccessManager.tsx  ← Manager picker + portal login issuance
    projects/
      [projectId]/
        page.tsx                   ← Project hub: ticket stats + team + embedded board (Milestones/Decisions/Documents paused, see above)
        ProjectMembersManager.tsx  ← Project team add/remove
        milestones/ decisions/ documents/  ← Paused panels (untouched, unreachable — see "Paused features")

  portal/
    login/                ← Client login (session-based, replaces portal_token)
      page.tsx / LoginForm.tsx / actions.ts
    (app)/                ← Route group requiring a valid client session
      layout.tsx          ← Topbar + PortalNav (Tickets only — Projects tab paused)
      template.tsx        ← Page-transition wrapper
      page.tsx            ← Client hub: ticket summary only (project list paused)
      tickets/            ← List / new / detail + ContactNamePicker
      projects/[projectId]/  ← Paused (layout.tsx redirects to /portal — see "Paused features")

  sign/[approvalToken]/   ← Sign-off page (email link destination) — UNCHANGED
    page.tsx              ← Server: validates token, shows state
    SignForm.tsx           ← Client: handles sign submission

  api/
    approvals/            ← send / sign / concern routes
    nudge/route.ts        ← GET: cron job for nudge reminders

components/
  dashboard/
    Header.tsx            ← Top nav (Overview/Tickets/Projects/Clients[/Team])
    NotificationBell.tsx  ← In-app notification dropdown

hooks/
  useNotifications.tsx    ← Realtime-subscribed notification context (team side)

lib/
  supabase/               ← Browser, server, and service role clients
  auth/
    client-session-core.ts   ← jose-only session sign/verify (Edge-safe, used by middleware.ts)
    client-session.ts        ← + bcryptjs password hashing (Node-only, Server Actions only)
    client-session-cookies.ts ← next/headers cookie wrapper
  portal/session-guard.ts  ← requireClientSession / getSessionClient / getSessionProject
  tickets/
    team-actions.ts        ← Server Actions: dashboard-side ticket CRUD (RLS-governed), findTicketByRef search
    portal-actions.ts      ← Server Actions: client-side ticket create/comment (service role + manual client_id checks)
  projects/
    actions.ts             ← createProject (auto-adds creator as first project_member) / deleteProject
    members-actions.ts     ← addProjectMember / removeProjectMember (RLS: can_manage_project_members)
  clients/access-actions.ts  ← Manager assignment + login credential issue/revoke
  notifications/create.ts   ← createTicketNotifications / getActorName
  email/index.ts          ← Resend helpers (approvals, nudge, concern, tickets) — lazy client, no-ops if RESEND_API_KEY unset
  pdf/                    ← PDF generation (TODO)
  utils/index.ts          ← Formatting, helpers, ticket status/priority config

types/index.ts            ← All TypeScript types (mirrors DB schema)
middleware.ts             ← Auth guard for /dashboard (Supabase session) AND /portal (client session JWT)
```

---

## What is built vs TODO

### Built
- [x] Database schema — full rebuild, `001`–`019`, fresh-project ready (see Database setup)
- [x] TypeScript types
- [x] Supabase client helpers (browser, server, service role)
- [x] Team auth middleware (Supabase Auth) + client portal session middleware (JWT)
- [x] Mobile block
- [x] Team login page
- [x] Client portal login (session-based, `/portal/login`)
- [x] Dashboard layout + sidebar (incl. Tickets nav + notification bell)
- [x] Dashboard overview page
- [x] Clients list + client detail (contacts, Manager picker, portal login issuance)
- [x] Projects list + new-project form + project detail page (hub)
- [x] Milestones / Decisions / Documents management (dashboard) + portal views
- [x] Client portal hub (session-based) — Tickets + Projects
- [x] Tickets: schema, RLS (Manager+team visibility), dashboard board/list + detail,
      portal create/list/detail, comments w/ @mentions, in-app + email notifications
- [x] Sign page (server + client form)
- [x] API: send approvals / sign approval / raise concern / nudge cron
- [x] Email templates (approval, nudge, concern, ticket confirmation/reply/resolved)
- [x] Motion/feedback polish: page transitions, optimistic UI, toasts, loading skeletons

### TODO
- [ ] PDF generation for signed records
- [ ] Vercel cron config for nudge (`vercel.json`) — file exists, confirm it's wired in the Vercel project
- [ ] Per-contact individual client logins (explicitly deferred — see Ticketing section)
- [ ] Real-time updates on the client portal (currently Server Action + `revalidatePath`, not Supabase Realtime — the client session isn't a Supabase Auth principal, so Realtime's RLS-gated subscriptions don't apply there)

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
| Client sign-off | `#EEEDFE` | `#3C3489` |
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

3. **The portal DOES have auth now** (client login — see Access model) but
   it's still not Supabase Auth, and RLS still isn't the enforcement layer for
   it. `/sign/[approvalToken]` remains the one truly public, unauthenticated
   surface — security there comes from the token being hard to guess (32
   random bytes) plus it being single-purpose (sign one thing, nothing else).

4. **Always use `createServiceRoleClient()` in API routes/Server Actions that
   handle sign-offs or run under the portal session**, since neither is a
   Supabase Auth principal RLS can evaluate. Authorization for those is a
   manual check in the action itself (e.g. `lib/portal/session-guard.ts`,
   `lib/tickets/portal-actions.ts` checking `ticket.client_id === session.clientId`)
   — don't skip that check because "the query is scoped to an id" isn't enough
   when the client bypasses RLS.

5. **Use Server Components by default.** Only add `'use client'` when you need
   interactivity (forms, onClick, useState, etc.).

6. **Keep the sign page simple and trustworthy.** It's what clients see when they
   receive an email. No clutter, no extra navigation, clear identity confirmation.

7. **Milestone regressions: never delete, always iterate.** Set `parent_id` to the
   previous milestone, increment `iteration`, set status back to `in_progress`.

8. **Document uploads go to Supabase Storage** `project-documents` bucket.
   Use the service role client in the upload API route. Store the `storage_path`
   in the `documents` table. Generate signed URLs on the fly for downloads (1hr expiry).

9. **The nudge cron** (`/api/nudge`) requires `Authorization: Bearer <CRON_SECRET>`
   header. Set `CRON_SECRET` in env. Configure in `vercel.json` for production.

10. **Company name is NuAIg.** In all UI copy, emails, and labels, use "NuAIg" not
    "Momentum Studio" or any placeholder. The client's company name comes from the
    `clients.name` field in the database.

11. **Ticket visibility is a real access-control feature, not just a UI filter.**
    `can_view_ticket()` / `is_on_client_team()` (migration `006`/`010`) are the
    single source of truth for "can this team member see/act on this ticket."
    Never re-implement that predicate inline in a query or a new RLS policy —
    call the existing SQL function, the same way `ticket_comments` and
    `ticket_assignees` both call it rather than each getting their own copy.
    If the rule ever needs to change, it changes in exactly one place.

12. **A ticket/comment's author is exactly one of `created_by_team_member_id`
    OR `created_by_client_name`**, enforced by a DB `CHECK` constraint. When
    writing a new query or UI against `tickets`/`ticket_comments`, always
    handle both — don't assume every row has a team-member author.

13. **New migrations continue the `NNN_description.sql` sequence** (currently
    through `019`) — one concern per file, idempotent (`IF NOT EXISTS`,
    `DROP POLICY IF EXISTS` before `CREATE POLICY`), and any RLS predicate
    used by more than one table extracted into its own `SECURITY DEFINER
    STABLE` SQL function first. Don't go back and edit an already-numbered
    migration file once it's part of the sequence — add a new one.

14. **`lib/email/index.ts`'s Resend client is lazy and no-ops without
    `RESEND_API_KEY`.** Don't reintroduce `new Resend(...)` at module scope —
    that crashes the Next.js build's page-data-collection step the moment any
    server action importing this file gets analyzed with the key unset.

15. **`lib/auth/client-session-core.ts` must stay bcryptjs-free.** It's the
    only auth file `middleware.ts` may import (Edge runtime — `bcryptjs`
    depends on Node's `crypto` and isn't Edge-compatible). Password hashing
    lives in `lib/auth/client-session.ts`, imported only from Server Actions.

16. **Motion and feedback are load-bearing UX requirements here, not
    decoration** — every dashboard/portal route transition goes through a
    `template.tsx` (framer-motion), every mutation gives `react-hot-toast`
    feedback, and ticket status/assignee/comment changes update local state
    optimistically before the server round-trip resolves. When adding a new
    mutating action, follow that pattern rather than a plain
    `await action(); router.refresh()`.
