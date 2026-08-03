import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { CLIENT_SESSION_COOKIE, verifyClientSessionToken } from '@/lib/auth/client-session-core'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl

  // Protect all /dashboard routes — redirect to login if not authenticated
  if (pathname.startsWith('/dashboard') && !session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // A team member with a temp/generated password must set a real one
  // before touching anything else — mirrors the client portal's
  // must_change_password gate. Checked here (not in dashboard/layout.tsx)
  // because change-password lives under the same /dashboard tree the
  // layout wraps, and this needs to exclude that one route to avoid a
  // redirect loop.
  if (pathname.startsWith('/dashboard') && session && pathname !== '/dashboard/change-password') {
    const { data: member } = await supabase
      .from('team_members')
      .select('must_change_password')
      .eq('id', session.user.id)
      .maybeSingle()
    if (member?.must_change_password) {
      return NextResponse.redirect(new URL('/dashboard/change-password', request.url))
    }
  }

  // Redirect authenticated users away from login page
  if (pathname === '/login' && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Portal routes require a valid client session cookie (login id +
  // password, one shared credential per client company) — replaces
  // the old per-project portal_token URL entirely.
  if (pathname.startsWith('/portal') && pathname !== '/portal/login') {
    const clientSession = await verifyClientSessionToken(
      request.cookies.get(CLIENT_SESSION_COOKIE)?.value
    )
    if (!clientSession) {
      return NextResponse.redirect(new URL('/portal/login', request.url))
    }
  }

  // Redirect an already-logged-in client away from the login page
  if (pathname === '/portal/login') {
    const clientSession = await verifyClientSessionToken(
      request.cookies.get(CLIENT_SESSION_COOKIE)?.value
    )
    if (clientSession) {
      return NextResponse.redirect(new URL('/portal', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
