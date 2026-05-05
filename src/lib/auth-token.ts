/**
 * Token format: <session_id>.<HMAC-SHA256(session_id, CALL_AUTH_SECRET)>
 * Mirror of call-nexfy/src/lib/auth-token.ts — must use same CALL_AUTH_SECRET.
 * Server-only.
 */

import crypto from "crypto";

const SECRET = process.env.CALL_AUTH_SECRET || "";
const HMAC_BYTES = 16;

export function tokenHmacForSession(sessionId: string): string {
  if (!SECRET) {
    console.warn("[auth-token] CALL_AUTH_SECRET not set");
    return "";
  }
  return crypto
    .createHmac("sha256", SECRET)
    .update(sessionId)
    .digest("hex")
    .slice(0, HMAC_BYTES * 2);
}

export function signToken(sessionId: string): string {
  return `${sessionId}.${tokenHmacForSession(sessionId)}`;
}
