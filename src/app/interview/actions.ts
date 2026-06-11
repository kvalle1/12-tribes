"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  createInterviewSession,
  getInterviewState,
  saveInterviewState,
} from "@/db/interview";
import { recordAnswer } from "@/lib/interview/session";

/**
 * Server Actions that own the Interview Session (ADR-0009). The client only ever
 * posts the answer text; the Session id lives in an httpOnly cookie and the
 * scoring state lives in Postgres, so no scoring state is sent to — or accepted
 * from — the client.
 */

const SESSION_COOKIE = "interview_session";

/** Begin a new Interview, persist it, and remember it in an httpOnly cookie. */
export async function beginInterview(): Promise<void> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

  const id = await createInterviewSession(userId);

  const jar = await cookies();
  jar.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  redirect("/interview");
}

/**
 * Record the participant's free-text answer to the current Turn, persist the
 * advanced Session, and route to the next Turn (or the result when complete).
 */
export async function submitAnswer(formData: FormData): Promise<void> {
  const answer = String(formData.get("answer") ?? "").trim();

  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (!id) redirect("/interview");

  const state = await getInterviewState(id);
  if (!state) {
    jar.delete(SESSION_COOKIE);
    redirect("/interview");
  }
  if (state.status === "complete") redirect("/interview/result");

  // Ignore an empty submission rather than recording a blank Turn.
  if (!answer) redirect("/interview");

  const next = recordAnswer(state, answer);
  await saveInterviewState(id, next);

  redirect(next.status === "complete" ? "/interview/result" : "/interview");
}
