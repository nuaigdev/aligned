'use client'

import { useEffect, useState } from 'react'

function computeGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function computeDate(): string {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Renders client-side (not SSR'd) so "morning/afternoon/evening" and the
 * date reflect the viewer's own local time zone — a server render always
 * runs in one fixed time zone, which is wrong for anyone not in it.
 */
export default function GreetingHeader({ name }: { name?: string }) {
  const [greeting, setGreeting] = useState<string | null>(null)
  const [date, setDate] = useState<string | null>(null)

  useEffect(() => {
    setGreeting(computeGreeting())
    setDate(computeDate())
  }, [])

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
        {greeting ?? 'Welcome'}{name ? `, ${name}` : ''}
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
        {date ?? ' '}
      </p>
    </div>
  )
}
