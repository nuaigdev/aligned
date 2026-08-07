// ============================================================
// Client (portal) authentication — the credential + session layer
// that replaced the old per-project portal_token URL.
//
// A client can have several named logins (client_logins table) —
// each with its own independent login id/password, all sharing the
// same client-scoped portal view. Session token logic lives in
// client-session-core.ts (jose only, Edge-safe, importable from
// middleware.ts); this file adds bcryptjs-based password hashing on
// top, which is Node-only and must NEVER be imported by middleware.
// ============================================================

import bcrypt from 'bcryptjs'

export {
  CLIENT_SESSION_COOKIE,
  CLIENT_SESSION_MAX_AGE,
  signClientSession,
  verifyClientSessionToken,
  type ClientSessionPayload,
} from './client-session-core'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/** Readable temp password for the "reset credentials" flow — no ambiguous characters. */
export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) out += '-'
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}
