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
 * Server Actions for the Interview. All state transitions run here on the
 * server (ADR 0009); the client only submits a free-text answer and carries an
 * opaque session id in an httpOnly cookie. The interpreter's Anthropic call is
 * an outbound dependency now — a failure isn't a bug in our logic, it's a
 * remote error — so we log and redirect back to the hub rather than surfacing
 * a raw stack to the participant.
 */

/**
 * `next/navigation`'s `redirect()` signals via a thrown error whose `digest`
 * starts with `NEXT_REDIRECT`. Any `try/catch` around a redirect must let that
 * error escape so the redirect actually fires. We detect it structurally (not
 * via an internal Next import) so this stays robust across Next patch releases.
 */
function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

/** Start a new Interview: create the server-side Session, remember it, show Turn 1. */
export async function startInterview(): Promise<void> {
  try {
    const session = await createInterviewSession();
    await setSessionCookie(session.id);
  } catch (error) {
    // Creating a Session should not normally fail; log then still send the
    // user somewhere they can retry rather than a Next.js error boundary.
    if (isRedirectError(error)) throw error;
    console.error("[interview] failed to create session", error);
  }
  redirect("/interview");
}

/** Record the participant's answer for the current Session and advance. */
export async function submitAnswer(formData: FormData): Promise<void> {
  const id = await getSessionCookie();
  if (!id) redirect("/interview");

  const answer = String(formData.get("answer") ?? "").trim();
  if (!answer) redirect("/interview");

  let updated;
  try {
    updated = await recordInterviewAnswer(id, answer);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    // Interpreter or DB failed. Log for the operator and send the user back to
    // the hub — refreshing there re-derives the current view from persisted
    // state, so they can retry the same question without losing progress.
    console.error("[interview] failed to record answer", error);
    redirect("/interview");
  }
  if (!updated) redirect("/interview");

  redirect(updated.status === "complete" ? "/interview/result" : "/interview");
}
