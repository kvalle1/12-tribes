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

  // Scoring calls the LLM and can fail (e.g. a transient API error). Recording
  // throws back to the hub rather than to an error page, leaving the Session
  // in progress on the same question so the participant can retry. The redirect
  // itself throws internally, so it runs outside the try.
  let complete = false;
  try {
    const updated = await recordInterviewAnswer(id, answer);
    if (!updated) redirect("/interview");
    complete = updated.status === "complete";
  } catch (error) {
    if (isRedirectError(error)) throw error;
    // Scoring failed (e.g. the LLM call errored). Bounce back to the same
    // question with a flag so the hub can tell the participant to retry,
    // rather than silently re-showing the question with no feedback.
    redirect("/interview?error=score");
  }

  redirect(complete ? "/interview/result" : "/interview");
}

/** Next.js signals a redirect by throwing; let those propagate, swallow the rest. */
function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}
