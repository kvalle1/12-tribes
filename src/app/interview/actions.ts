"use server";

import { redirect } from "next/navigation";
import {
  createInterviewSession,
  getInterviewSession,
  recordInterviewAnswer,
} from "@/lib/interview/repository";
import {
  getSessionCookie,
  setSessionCookie,
} from "@/lib/interview/session-cookie";

/**
 * Server Actions for the Interview walking skeleton. All state transitions run
 * here on the server (ADR-0009); the client only submits a free-text answer and
 * carries an opaque session id in an httpOnly cookie.
 */

/** Start a new Interview: create the server-side Session, remember it, show Turn 1. */
export async function startInterview(): Promise<void> {
  const session = await createInterviewSession();
  await setSessionCookie(session.id);
  redirect("/interview");
}

/** Record the participant's answer for the current Session and advance. */
export async function submitAnswer(formData: FormData): Promise<void> {
  const id = await getSessionCookie();
  if (!id) redirect("/interview");

  const answer = String(formData.get("answer") ?? "").trim();
  if (!answer) redirect("/interview");

  const updated = await recordInterviewAnswer(id, answer);
  if (!updated) redirect("/interview");

  redirect(updated.status === "complete" ? "/interview/result" : "/interview");
}

/**
 * Resolve the current Session from the cookie, or null when there isn't one
 * (or the cookie points at a Session that no longer exists). Read by the
 * Interview pages to decide what to render — the basis for resume.
 */
export async function currentSession() {
  const id = await getSessionCookie();
  if (!id) return null;
  return getInterviewSession(id);
}
