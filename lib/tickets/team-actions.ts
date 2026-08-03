'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { createTicketNotifications, getActorName, createClientNotification } from '@/lib/notifications/create'
import { sendTicketConfirmationEmail, sendTicketReplyEmail, sendTicketResolvedEmail } from '@/lib/email/index'
import { getTicketContactRecipients, getManagerContact, withManagerCopy } from '@/lib/tickets/contacts'
import { ticketClientCode } from '@/lib/utils'
import type { CreateTicketInput, TicketStatus, TicketPriority, TicketType } from '@/types'

async function currentTeamMemberId(): Promise<string | null> {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function createTicket(
  input: Omit<CreateTicketInput, 'created_by_client_name' | 'client_id'> & { project_id: string }
): Promise<{ id: string } | { error: string }> {
  const teamMemberId = await currentTeamMemberId()
  if (!teamMemberId) return { error: 'Not signed in.' }
  if (!input.title.trim()) return { error: 'Give the ticket a title.' }
  if (!input.project_id) return { error: 'Pick a project — every ticket you create needs to belong to one of your projects.' }

  const supabase = createSupabaseServerClient()

  // client_id is derived from the project rather than trusted from the
  // caller — the picker only ever offers the team member's own projects,
  // and RLS (migration 038) re-checks project membership on insert anyway.
  const { data: project } = await supabase.from('projects').select('client_id').eq('id', input.project_id).maybeSingle()
  if (!project) return { error: 'That project could not be found.' }

  const ticketType = input.ticket_type || 'client'

  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({
      client_id: project.client_id,
      project_id: input.project_id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category || 'general',
      ticket_type: ticketType,
      priority: input.priority || 'medium',
      due_date: input.due_date || null,
      created_by_team_member_id: teamMemberId,
    })
    .select('id, ref_number')
    .single()

  if (error || !ticket) {
    return { error: error?.message || 'Could not create the ticket — check you have access to this client.' }
  }

  if (input.assignee_ids && input.assignee_ids.length > 0) {
    await supabase.from('ticket_assignees').insert(
      input.assignee_ids.map(teamMemberId2 => ({
        ticket_id: ticket.id,
        team_member_id: teamMemberId2,
        assigned_by: teamMemberId,
      }))
    )
  }

  const actor = await getActorName(supabase, teamMemberId)
  const { data: client } = await supabase.from('clients').select('manager_id, name, slug').eq('id', project.client_id).maybeSingle()

  const recipients = [...(input.assignee_ids ?? [])]
  if (client?.manager_id) recipients.push(client.manager_id)

  await createTicketNotifications(
    supabase, recipients, teamMemberId,
    input.assignee_ids?.length ? 'ticket_assigned' : 'ticket_updated',
    'New ticket',
    `${actor} logged "${input.title.trim()}" for ${client?.name ?? 'a client'}`,
    ticket.id
  )

  // A team-raised ticket that's still client-visible tells the client about
  // it the same way a portal-raised one does — they didn't submit it
  // themselves, so the copy frames it as "logged for you", not "thanks".
  if (ticketType === 'client') {
    const [contacts, manager] = await Promise.all([
      getTicketContactRecipients(supabase, project.client_id, input.project_id),
      getManagerContact(supabase, client?.manager_id),
    ])
    await sendTicketConfirmationEmail({
      recipients: withManagerCopy(contacts, manager),
      ticketId: ticket.id,
      refNumber: ticket.ref_number,
      title: input.title.trim(),
      raisedByName: actor,
      raisedByRole: 'team',
      clientCode: client?.slug ? ticketClientCode(client.slug) : undefined,
    })
  }

  revalidatePath('/dashboard/tickets')
  revalidatePath('/portal/tickets')
  revalidatePath('/portal')
  return { id: ticket.id }
}

export async function updateTicket(
  ticketId: string,
  patch: Partial<{
    title: string
    description: string | null
    status: TicketStatus
    priority: TicketPriority
    category: string
    due_date: string | null
    blocked_on: 'client' | 'team' | null
    project_id: string | null
    ticket_type: TicketType
  }>
): Promise<{ ok: true } | { error: string }> {
  const teamMemberId = await currentTeamMemberId()
  const supabase = createSupabaseServerClient()

  // A client-raised ticket can never be marked internal — checked here
  // ahead of the write (a clearer error than the DB trigger's, which still
  // backstops this against a direct write). Team-raised tickets can move
  // freely in either direction. Also captures the pre-update type so we can
  // tell an internal→client flip (the client's first look at this ticket)
  // apart from a client ticket just staying a client ticket.
  let previousTicketType: TicketType | undefined
  if (patch.ticket_type) {
    const { data: existing } = await supabase.from('tickets').select('created_by_client_name, ticket_type').eq('id', ticketId).maybeSingle()
    previousTicketType = existing?.ticket_type
    if (patch.ticket_type === 'internal' && existing?.created_by_client_name) {
      return { error: 'This ticket was raised by the client and can only stay a client ticket.' }
    }
  }

  const { error } = await supabase.from('tickets').update(patch).eq('id', ticketId)
  if (error) return { error: error.message }

  const becameClientVisible = patch.ticket_type === 'client' && previousTicketType === 'internal'

  if (patch.status || becameClientVisible) {
    const { data: ticket } = await supabase
      .from('tickets')
      .select('title, ref_number, client_id, project_id, created_by_team_member_id, ticket_assignees(team_member_id), clients(slug, manager_id)')
      .eq('id', ticketId)
      .maybeSingle()

    if (ticket) {
      const actor = await getActorName(supabase, teamMemberId)
      const clientMeta = ticket.clients as any
      const clientCode = clientMeta?.slug ? ticketClientCode(clientMeta.slug) : undefined

      if (patch.status) {
        const recipients = [
          ticket.created_by_team_member_id,
          ...((ticket.ticket_assignees as any[]) ?? []).map(a => a.team_member_id),
        ].filter(Boolean) as string[]

        await createTicketNotifications(
          supabase, recipients, teamMemberId, 'ticket_status_changed',
          'Ticket updated',
          `${actor} moved "${ticket.title}" to ${patch.status.replace('_', ' ')}`,
          ticketId
        )

        if (patch.status === 'resolved') {
          const [contacts, manager] = await Promise.all([
            getTicketContactRecipients(supabase, ticket.client_id, ticket.project_id),
            getManagerContact(supabase, clientMeta?.manager_id),
          ])
          await sendTicketResolvedEmail({
            recipients: withManagerCopy(contacts, manager),
            ticketId, refNumber: ticket.ref_number, title: ticket.title, clientCode,
          })
          await createClientNotification(
            createServiceRoleClient(), ticket.client_id, 'ticket_resolved',
            'Ticket resolved', ticket.title,
            `/portal/tickets/${ticketId}`
          )
        }
      }

      // The ticket just became visible on the client's portal for the first
      // time (it was internal until now) — tell them it exists, the same
      // confirmation a brand-new ticket gets.
      if (becameClientVisible) {
        const [contacts, manager] = await Promise.all([
          getTicketContactRecipients(supabase, ticket.client_id, ticket.project_id),
          getManagerContact(supabase, clientMeta?.manager_id),
        ])
        await sendTicketConfirmationEmail({
          recipients: withManagerCopy(contacts, manager),
          ticketId, refNumber: ticket.ref_number, title: ticket.title,
          raisedByName: actor, raisedByRole: 'team', clientCode,
        })
      }
    }
  }

  revalidatePath('/dashboard/tickets')
  revalidatePath(`/dashboard/tickets/${ticketId}`)
  revalidatePath('/portal/tickets')
  revalidatePath(`/portal/tickets/${ticketId}`)
  return { ok: true }
}

export async function setTicketAssignees(
  ticketId: string,
  teamMemberIds: string[]
): Promise<{ ok: true } | { error: string }> {
  const teamMemberId = await currentTeamMemberId()
  if (!teamMemberId) return { error: 'Not signed in.' }

  const supabase = createSupabaseServerClient()

  const { data: existing } = await supabase
    .from('ticket_assignees')
    .select('team_member_id')
    .eq('ticket_id', ticketId)

  const currentIds = new Set((existing ?? []).map(a => a.team_member_id))
  const nextIds = new Set(teamMemberIds)

  const toAdd = teamMemberIds.filter(id => !currentIds.has(id))
  const toRemove = [...currentIds].filter(id => !nextIds.has(id))

  if (toAdd.length > 0) {
    const { error } = await supabase.from('ticket_assignees').insert(
      toAdd.map(id => ({ ticket_id: ticketId, team_member_id: id, assigned_by: teamMemberId }))
    )
    if (error) return { error: error.message }

    const { data: ticket } = await supabase.from('tickets').select('title').eq('id', ticketId).maybeSingle()
    const actor = await getActorName(supabase, teamMemberId)
    await createTicketNotifications(
      supabase, toAdd, teamMemberId, 'ticket_assigned',
      'New ticket assigned',
      `${actor} assigned you to "${ticket?.title ?? 'a ticket'}"`,
      ticketId
    )
  }

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('ticket_assignees')
      .delete()
      .eq('ticket_id', ticketId)
      .in('team_member_id', toRemove)
    if (error) return { error: error.message }
  }

  revalidatePath('/dashboard/tickets')
  revalidatePath(`/dashboard/tickets/${ticketId}`)
  return { ok: true }
}

export async function postTicketComment(
  ticketId: string,
  body: string,
  mentionedTeamMemberIds: string[] = [],
  visibleToClient: boolean = false
): Promise<{ id: string } | { error: string }> {
  const teamMemberId = await currentTeamMemberId()
  if (!teamMemberId) return { error: 'Not signed in.' }
  if (!body.trim()) return { error: 'Comment cannot be empty.' }

  const supabase = createSupabaseServerClient()

  const { data: ticket } = await supabase
    .from('tickets')
    .select('title, ref_number, client_id, project_id, ticket_type, created_by_team_member_id, ticket_assignees(team_member_id), clients(slug, manager_id)')
    .eq('id', ticketId)
    .maybeSingle()

  if (!ticket) return { error: 'Ticket not found.' }

  // Internal tickets never reach the client — force this regardless of what
  // the composer sent (the DB trigger enforces the same rule on the row
  // itself; this keeps the in-memory decision for email/notifications
  // consistent with it rather than trusting a stale client-sent flag).
  const effectiveVisibleToClient = ticket.ticket_type === 'internal' ? false : visibleToClient

  const { data: comment, error } = await supabase
    .from('ticket_comments')
    .insert({
      ticket_id: ticketId,
      body: body.trim(),
      mentioned_team_member_ids: mentionedTeamMemberIds,
      created_by_team_member_id: teamMemberId,
      visible_to_client: effectiveVisibleToClient,
    })
    .select('id')
    .single()

  if (error || !comment) return { error: error?.message || 'Could not post the comment.' }

  {
    const actor = await getActorName(supabase, teamMemberId)
    const mentioned = new Set(mentionedTeamMemberIds)
    const audience = [
      ticket.created_by_team_member_id,
      ...((ticket.ticket_assignees as any[]) ?? []).map(a => a.team_member_id),
    ].filter((id): id is string => Boolean(id) && !mentioned.has(id as string))

    await createTicketNotifications(supabase, audience, teamMemberId, 'ticket_commented', 'New comment', `${actor} commented on "${ticket.title}"`, ticketId)
    await createTicketNotifications(supabase, mentionedTeamMemberIds, teamMemberId, 'ticket_mentioned', 'You were mentioned', `${actor} mentioned you on "${ticket.title}"`, ticketId)

    // Only a comment explicitly marked "reply to client" reaches the
    // client's inbox — an internal note must never leak to the client just
    // because we email on every team comment by default.
    if (effectiveVisibleToClient) {
      const clientMeta = ticket.clients as any
      const clientCode = clientMeta?.slug ? ticketClientCode(clientMeta.slug) : undefined
      const [contacts, manager] = await Promise.all([
        getTicketContactRecipients(supabase, ticket.client_id, ticket.project_id),
        getManagerContact(supabase, clientMeta?.manager_id),
      ])
      await sendTicketReplyEmail({
        recipients: withManagerCopy(contacts, manager),
        ticketId, refNumber: ticket.ref_number, title: ticket.title, replyBody: body.trim(), actorName: actor, clientCode,
      })
      await createClientNotification(
        createServiceRoleClient(), ticket.client_id, 'ticket_replied',
        `New reply on ${ticket.title}`, body.trim().slice(0, 140),
        `/portal/tickets/${ticketId}`
      )
    }
  }

  revalidatePath(`/dashboard/tickets/${ticketId}`)
  revalidatePath(`/portal/tickets/${ticketId}`)
  return { id: comment.id }
}

export async function editTicketComment(
  commentId: string,
  body: string,
  mentionedTeamMemberIds: string[] = [],
  visibleToClient?: boolean
): Promise<{ ok: true } | { error: string }> {
  const supabase = createSupabaseServerClient()
  const { data: comment } = await supabase
    .from('ticket_comments')
    .select('ticket_id')
    .eq('id', commentId)
    .single()

  const { error } = await supabase
    .from('ticket_comments')
    .update({
      body: body.trim(),
      mentioned_team_member_ids: mentionedTeamMemberIds,
      ...(visibleToClient !== undefined ? { visible_to_client: visibleToClient } : {}),
    })
    .eq('id', commentId)

  if (error) return { error: error.message }
  if (comment) {
    revalidatePath(`/dashboard/tickets/${comment.ticket_id}`)
    revalidatePath(`/portal/tickets/${comment.ticket_id}`)
  }
  return { ok: true }
}

export async function deleteTicketComment(commentId: string): Promise<{ ok: true } | { error: string }> {
  const supabase = createSupabaseServerClient()
  const { data: comment } = await supabase
    .from('ticket_comments')
    .select('ticket_id')
    .eq('id', commentId)
    .single()

  const { error } = await supabase.from('ticket_comments').delete().eq('id', commentId)
  if (error) return { error: error.message }
  if (comment) {
    revalidatePath(`/dashboard/tickets/${comment.ticket_id}`)
    revalidatePath(`/portal/tickets/${comment.ticket_id}`)
  }
  return { ok: true }
}

export interface TicketSearchResult {
  id: string
  ref_number: number
  title: string
  client_name: string | null
  client_slug: string | null
}

/**
 * Universal ticket search (header search box) — tickets are viewable by any
 * active team member regardless of project (migration 038), so this
 * searches the whole system, not just the caller's own projects.
 *
 * Backed by the search_tickets() SQL function (migration 039), which does
 * the ranking in a single indexed round trip: an identifier match (client
 * code and/or ticket number, matched as a prefix, case-insensitive — "math",
 * "MATH-017", and "17" all resolve) ranks above a plain title match, and an
 * exact identifier match ranks above a partial one.
 */
export async function searchTickets(query: string): Promise<TicketSearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.rpc('search_tickets', { p_query: trimmed, p_limit: 8 })
  if (error) {
    console.error('searchTickets failed:', error)
    return []
  }

  return (data ?? []).map((t: any) => ({
    id: t.id,
    ref_number: t.ref_number,
    title: t.title,
    client_name: t.client_name,
    client_slug: t.client_slug,
  }))
}
