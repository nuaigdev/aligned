import { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { Plus, Users, UserCog, KeyRound, Building2 } from 'lucide-react'
import { StatCard } from '@/components/dashboard/StatCard'
import { EmptyState } from '@/components/dashboard/EmptyState'

export const dynamic = 'force-dynamic'

export default async function ClientsPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: clients }, { data: me }, { data: activeLogins }] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, slug, created_at, manager_id, projects(id), manager:team_members(name)')
      .order('name'),
    user ? supabase.from('team_members').select('role').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('client_logins').select('client_id').eq('is_active', true),
  ])

  const canCreate = me?.role === 'admin'
  const total = clients?.length ?? 0
  const withManager = clients?.filter(c => c.manager_id).length ?? 0
  const clientIdsWithLogin = new Set((activeLogins ?? []).map(l => l.client_id))
  const withLogin = clientIdsWithLogin.size

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>Clients</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{total} total</p>
        </div>
        {canCreate && (
          <Link
            href="/dashboard/clients/new"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              background: 'var(--brand-600)',
              color: '#fff',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            <Plus size={14} /> New client
          </Link>
        )}
      </div>

      {total > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
          <StatCard icon={Users} label="Total clients" value={total} accent="var(--brand-600)" delayMs={0} />
          <StatCard icon={UserCog} label="Manager assigned" value={withManager} accent="#0C447C" delayMs={40} />
          <StatCard icon={KeyRound} label="Portal login issued" value={withLogin} accent="#3B6D11" delayMs={80} />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {clients?.map((client, i) => {
          const projectCount = (client.projects as any[])?.length ?? 0
          const manager = client.manager as any
          return (
            <Link
              key={client.id}
              href={`/dashboard/clients/${client.id}`}
              className="hover-card animate-in"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '13px 16px',
                background: 'var(--bg-primary)',
                border: '0.5px solid var(--border-default)',
                borderRadius: '10px',
                textDecoration: 'none',
                animationDelay: `${Math.min(i, 10) * 30}ms`,
              }}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '9px',
                background: 'linear-gradient(135deg, var(--brand-200), var(--brand-600))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 600,
                color: '#fff',
                flexShrink: 0,
              }}>
                {client.name.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{client.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                  Added {formatDate(client.created_at)}
                  {manager?.name && ` · Managed by ${manager.name}`}
                </div>
              </div>
              {clientIdsWithLogin.has(client.id) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--success-text)', flexShrink: 0 }}>
                  <KeyRound size={11} /> Portal active
                </div>
              )}
              <div style={{
                fontSize: '11px',
                padding: '2px 9px',
                borderRadius: '10px',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-tertiary)',
                fontWeight: 500,
                flexShrink: 0,
              }}>
                {projectCount} project{projectCount !== 1 ? 's' : ''}
              </div>
            </Link>
          )
        })}

        {total === 0 && (
          <EmptyState
            icon={Building2}
            title="No clients yet"
            description={canCreate ? 'Add your first client to start tracking projects and tickets for them.' : 'An admin needs to add a client before you can start tracking projects and tickets for them.'}
            actionLabel={canCreate ? 'Add your first client' : undefined}
            actionHref={canCreate ? '/dashboard/clients/new' : undefined}
          />
        )}
      </div>
    </div>
  )
}
