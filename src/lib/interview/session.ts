import "server-only";
import {
  getInterviewSession,
  type InterviewSessionRow,
} from "./repository";
import { getSessionCookie } from "./session-cookie";

/**
 * Server-only resolver for the current Interview Session.
 *
 * This is read during RSC render to decide what the Interview pages show — the
 * basis for resume (ADR-0011). It lives in a `server-only` module rather than in
 * `actions.ts` on purpose: every export of a `"use server"` file is published as
 * a client-invokable Server Action endpoint, and this returns the authoritative
 * Session row (including `profile`/`turns`). Keeping it here preserves the
 * ADR-0009 trust boundary — scoring state is read on the server, never handed to
 * the client — and importing it into a client bundle is a build error.
 */
export async function currentSession(): Promise<InterviewSessionRow | null> {
  const id = await getSessionCookie();
  if (!id) return null;
  return getInterviewSession(id);
}
