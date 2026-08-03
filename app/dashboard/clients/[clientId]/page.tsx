import { createSupabaseServerClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import ContactsManager from './ContactsManager'
import ClientAccessManager from './ClientAccessManager'
import DeleteConfirmButton from '@/components/dashboard/DeleteConfirmButton'
import { deleteClient } from '@/lib/clients/actions'
import type { ClientContact } from '@/types'

const STATUS_DOT: Record<string, string> = {
  active: '#3B6D11', awaiting_client: '#BA7517', awaiting_team: '#185FA5',
  on_hold: '#888780', completed: '#3B6D11', archived: '#B4B2A9',
}
const STATUS_LABEL: Record<string, string> = {
  active: 'Active', awaiting_client: 'Awaiting client', awaiting_team: 'Awaiting team',
  on_hold: 'On hold', completed: 'Completed', archived: 'Archived',
}

export const dynamic = 'force-dynamic'

export default async function ClientDetailPage({ params }: { params: { clientId: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: client }, { data: activeContacts }, { data: formerContacts }, { data: managers }, { count: ticketCount }, { data: me }] = await Promise.all([
    supabase
      .from('clients')
      .select('*, projects(id, name, status, started_at, updated_at)')
      .eq('id', params.clientId)
      .single(),
    supabase
      .from('client_contacts')
      .select('*')
      .eq('client_id', params.clientId)
      .is('project_id', null)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('client_contacts')
      .select('*')
      .eq('client_id', params.clientId)
      .is('project_id', null)
      .eq('is_active', false)
      .order('removed_at', { ascending: false }),
    supabase
      .from('team_members')
      .select('*')
      .in('role', ['admin', 'manager'])
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', params.clientId),
    user ? supabase.from('team_members').select('role').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null }),
  ])

  if (!client) notFound()

  const projects = (client.projects as any[]) ?? []
  const canCreateProject = me?.role === 'admin' || me?.role === 'manager'
  const isAdmin = me?.role === 'admin'

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>
          <Link href="/dashboard/clients" style={{ color: '#EA580C', textDecoration: 'none' }}>Clients</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{client.name}</h1>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              Added {formatDate(client.created_at)} · {projects.length} project{projects.length !== 1 ? 's' : ''}
            </p>
          </div>
          {canCreateProject && (
            <Link
              href={`/dashboard/projects/new?client=${client.id}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '7px 14px',
                background: '#EA580C',
                color: '#fff',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              + New project
            </Link>
          )}
        </div>
      </div>

      {/* Projects */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{
          fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)',
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px',
        }}>
          Projects
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {projects.map((project: any) => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '11px 14px',
                background: 'var(--bg-primary)',
                border: '0.5px solid var(--border-default)',
                borderRadius: '10px',
                textDecoration: 'none',
              }}
            >
              <div style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background: STATUS_DOT[project.status] || '#888780', flexShrink: 0,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{project.name}</div>
                {project.started_at && (
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                    Started {formatDate(project.started_at)}
                  </div>
                )}
              </div>
              <div style={{
                fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                background: 'var(--bg-tertiary)', color: STATUS_DOT[project.status] || '#888780', fontWeight: 500,
              }}>
                {STATUS_LABEL[project.status] || project.status}
              </div>
            </Link>
          ))}
          {projects.length === 0 && (
            <div style={{
              padding: '32px', textAlign: 'center', background: 'var(--bg-primary)',
              border: '0.5px solid var(--border-default)', borderRadius: '10px',
            }}>
              <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>No projects yet</div>
              {canCreateProject && (
                <Link
                  href={`/dashboard/projects/new?client=${client.id}`}
                  style={{ fontSize: '13px', color: '#EA580C', textDecoration: 'none' }}
                >
                  Create first project →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Manager + portal login */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
          Access
        </div>
        {isAdmin ? (
          <ClientAccessManager
            clientId={params.clientId}
            managers={(managers ?? []) as any}
            currentManagerId={client.manager_id}
            loginId={client.login_id}
            mustChangePassword={client.must_change_password}
            lastLoginAt={client.last_login_at}
          />
        ) : (
          <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '18px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <div style={{ marginBottom: '6px' }}>
              Manager: {(managers ?? []).find((m: any) => m.id === client.manager_id)?.name ?? 'None assigned'}
            </div>
            <div>Portal login: {client.login_id ? 'Active' : 'Not set up'}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '8px' }}>Only admins can change manager assignment or portal credentials.</div>
          </div>
        )}
      </div>

      {/* Contacts — managed by client component */}
      <ContactsManager
        clientId={params.clientId}
        contacts={(activeContacts ?? []) as ClientContact[]}
        formerContacts={(formerContacts ?? []) as ClientContact[]}
        canManage={isAdmin}
      />

      {/* Danger zone */}
      {isAdmin && (
        <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: '0.5px solid var(--border-default)' }}>
          <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Danger zone
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '14px 16px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>Delete this client</div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                Permanently removes {client.name} and everything under them.
              </div>
            </div>
            <DeleteConfirmButton
              entityLabel="client"
              confirmText={client.name}
              cascadeWarning={`This permanently deletes ${projects.length} project(s), ${ticketCount ?? 0} ticket(s), and all contacts and documents for ${client.name}.`}
              action={deleteClient}
              entityId={client.id}
              redirectTo="/dashboard/clients"
            />
          </div>
        </div>
      )}
    </div>
  )
}
