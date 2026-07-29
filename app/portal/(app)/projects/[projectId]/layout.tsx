import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getSessionProject } from '@/lib/portal/session-guard'

export default async function PortalProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { projectId: string }
}) {
  const project = await getSessionProject(params.projectId)

  return (
    <div>
      <Link
        href="/portal"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          fontSize: '12px', color: 'var(--text-tertiary)', textDecoration: 'none',
          marginBottom: '10px',
        }}
      >
        <ArrowLeft size={12} /> All projects
      </Link>

      <div style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 500, color: 'var(--text-primary)' }}>
        {project.name}
      </div>

      {children}
    </div>
  )
}
