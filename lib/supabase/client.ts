import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr'

let instance: ReturnType<typeof createSSRBrowserClient> | null = null

// Uses @supabase/ssr so the session is stored in cookies, not just localStorage.
// This lets middleware and Server Components read the session without an extra round-trip.
export function createBrowserClient() {
  if (instance) return instance
  instance = createSSRBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  return instance
}
