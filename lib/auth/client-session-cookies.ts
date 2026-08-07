// ============================================================
// next/headers wrapper around client-session.ts — for use in
// Server Components, Server Actions, and Route Handlers only.
// Middleware reads/verifies the cookie directly via
// request.cookies + verifyClientSessionToken (see middleware.ts).
// ============================================================

import { cookies } from 'next/headers'
import {
  CLIENT_SESSION_COOKIE,
  CLIENT_SESSION_MAX_AGE,
  signClientSession,
  verifyClientSessionToken,
  type ClientSessionPayload,
} from './client-session'

export async function getClientSession(): Promise<ClientSessionPayload | null> {
  const token = cookies().get(CLIENT_SESSION_COOKIE)?.value
  return verifyClientSessionToken(token)
}

export async function setClientSessionCookie(clientId: string, clientLoginId: string) {
  const token = await signClientSession(clientId, clientLoginId)
  cookies().set(CLIENT_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: CLIENT_SESSION_MAX_AGE,
  })
}

export async function clearClientSessionCookie() {
  cookies().set(CLIENT_SESSION_COOKIE, '', { path: '/', maxAge: 0 })
}
