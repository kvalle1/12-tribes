"use server";

import { redirect } from "next/navigation";
import {
  createInterviewSession,
  recordInterviewAnswer,
} from "@/lib/interview/repository";
import {
  getSessionCookie,
  setSessionCookie,
} from "@/lib/interview/session-cookie";

/**
 * Server Actions for the Interview. All state transitions and scoring run here
 * on the server (ADR-0009); the client only submits a free-text answer and
 * carries an opaque session id in an httpOnly cookie. Scoring an answer makes a
 * Claude call (see the repository/agent layer), so it can fail — a failure
 * leaves the Session resumable at the same Turn and surfaces an error.
 */

/** Start a new Interview: create the server-side Session, remember it, show Turn 1. */
export async function startInterview(): Promise<void> {
  const session = await createInterviewSession();
  await setSessionCookie(session.id);
  redirect("/interview");
}

/** Record and score the participant's answer for the current Session and advance. */
export async function submitAnswer(formData: FormData): Promise<void> {
  const id = await getSessionCookie();
  if (!id) redirect("/interview");

  const answer = String(formData.get("answer") ?? "").trim();
  if (!answer) redirect("/interview");

  // Keep `redirect` out of the try — it signals by throwing. The only thing
  // that can fail here is scoring (a Claude/DB call).
  let updated: Awaited<ReturnType<typeof recordInterviewAnswer>>;
  try {
    updated = await recordInterviewAnswer(id, answer);
  } catch {
    // The answer was not recorded, so the Session stays on this Turn; surface
    // a retriable error rather than a 500.
    redirect("/interview?error=score");
  }

  if (!updated) redirect("/interview");
  redirect(updated.status === "complete" ? "/interview/result" : "/interview");
}
