"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  findActiveSession,
  insertSession,
  updateSession,
} from "@/db/interview-repository";
import { recordAnswer, startSession } from "@/lib/interview/session";

/**
 * Server Actions driving the Interview's server-authoritative loop (ADR-0009).
 * The client posts an answer; the server owns the Session, scores it (a no-op in
 * this slice), decides the next Turn, and persists every Turn to Postgres so the
 * run is resumable (ADR-0011). No scoring state is sent to or accepted from the
 * client — actions take only the free-text answer.
 *
 * Server Actions are reachable by direct POST, so every action re-checks auth.
 */

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/signin");
  }
  return userId;
}

/** Start an Interview — or resume the one already in flight. */
export async function startInterview(): Promise<void> {
  const userId = await requireUserId();

  // Resume rather than spawn a duplicate if an interview is already underway.
  const active = await findActiveSession(userId);
  if (!active) {
    await insertSession(
      startSession({ id: crypto.randomUUID(), userId, now: new Date() }),
    );
  }

  redirect("/interview");
}

/** Record the answer to the current Turn and advance the Session. */
export async function submitAnswer(formData: FormData): Promise<void> {
  const userId = await requireUserId();

  const active = await findActiveSession(userId);
  if (!active) {
    // Nothing in flight (stale tab, double submit, already finished) — restart
    // from the entry point rather than erroring.
    redirect("/interview");
  }

  const answer = String(formData.get("answer") ?? "");
  if (answer.trim().length === 0) {
    // Empty answers are not a Turn; re-show the current question.
    redirect("/interview");
  }

  const next = recordAnswer(active, answer, new Date());
  await updateSession(next);

  redirect(next.status === "complete" ? "/interview/result" : "/interview");
}
