// ============================================================
// Client (portal) session tokens — jose only, NO bcryptjs.
//
// Split out from client-session.ts specifically so middleware.ts
// (which runs on the Edge runtime) can verify the session cookie
// without pulling in bcryptjs, which depends on Node's `crypto`
// module and isn't Edge-compatible. Password hashing/verification
// lives in client-session.ts and is only ever used from Server
// Actions / Route Handlers, never from middleware.
// ============================================================

import { SignJWT, jwtVerify } from 'jose'

export const CLIENT_SESSION_COOKIE = 'aligned_client_session'
const SESSION_TTL = '30d'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
export const CLIENT_SESSION_MAX_AGE = SESSION_MAX_AGE_SECONDS

export interface ClientSessionPayload {
  clientId: string
}

function getSecretKey() {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is not set — required to sign client portal sessions')
  }
  return new TextEncoder().encode(secret)
}

export async function signClientSession(clientId: string): Promise<string> {
  return new SignJWT({ clientId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(getSecretKey())
}

export async function verifyClientSessionToken(
  token: string | undefined | null
): Promise<ClientSessionPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    if (typeof payload.clientId !== 'string') return null
    return { clientId: payload.clientId }
  } catch {
    return null
  }
}
