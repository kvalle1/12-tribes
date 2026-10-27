"use server";

import { redirect } from "next/navigation";
import {
  createInterviewSession,
  recordInterviewTurn,
  type TurnSubmission,
} from "@/lib/interview/repository";
import {
  getSessionCookie,
  setSessionCookie,
} from "@/lib/interview/session-cookie";

/**
 * Server Actions for the Interview. All state transitions run here on the server
 * (ADR-0009); the client only submits a free-text answer — or, for a Dilemma, a
 * choice plus a free-text "why" — and carries an opaque session id in an
 * httpOnly cookie.
 */

/** Start a new Interview: create the server-side Session, remember it, show Turn 1. */
export async function startInterview(): Promise<void> {
  const session = await createInterviewSession();
  await setSessionCookie(session.id);
  redirect("/interview");
}

/**
 * Record the participant's submission for the current Session and advance. The
 * form carries the pending Turn's `kind`: a plain question submits `answer`; a
 * Dilemma submits `choice` (A/B) plus the free-text `why`.
 */
export async function submitAnswer(formData: FormData): Promise<void> {
  const id = await getSessionCookie();
  if (!id) redirect("/interview");

  const turnCount = Number(formData.get("turnCount"));
  if (!Number.isInteger(turnCount)) redirect("/interview");

  let submission: TurnSubmission;
  if (formData.get("kind") === "dilemma") {
    const choice = formData.get("choice");
    const why = String(formData.get("why") ?? "").trim();
    if ((choice !== "A" && choice !== "B") || !why) redirect("/interview");
    submission = { kind: "dilemma", choice, why };
  } else {
    const answer = String(formData.get("answer") ?? "").trim();
    if (!answer) redirect("/interview");
    submission = { kind: "question", answer };
  }

  const updated = await recordInterviewTurn(id, submission, turnCount);
  if (!updated) redirect("/interview");

  redirect(updated.status === "complete" ? "/interview/result" : "/interview");
}
