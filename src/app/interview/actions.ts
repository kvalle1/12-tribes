"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  clearSessionIdCookie,
  getSessionIdCookie,
  setSessionIdCookie,
} from "@/lib/interview/cookie";
import {
  createInterviewSession,
  getInterviewSession,
  updateInterviewSession,
} from "@/lib/interview/repository";
import { isComplete, recordAnswer } from "@/lib/interview/session";

/**
 * Server Actions driving the walking-skeleton Interview. All scoring state lives
 * on the server (ADR-0009): the client only posts the free-text answer and is
 * never trusted with Session internals.
 */

/** Begin a new Interview, binding the browser to the created Session. */
export async function startInterview(): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const id = await createInterviewSession(userId);
  await setSessionIdCookie(id);

  redirect("/interview");
}

/** Record the participant's answer to the current question and advance. */
export async function submitAnswer(formData: FormData): Promise<void> {
  const id = await getSessionIdCookie();
  if (!id) redirect("/interview");

  const state = await getInterviewSession(id);
  if (!state) {
    // Cookie points at a Session that no longer exists — start over cleanly.
    await clearSessionIdCookie();
    redirect("/interview");
  }

  const answer = String(formData.get("answer") ?? "");
  const next = recordAnswer(state, answer);
  await updateInterviewSession(id, next);

  redirect(isComplete(next) ? "/interview/result" : "/interview");
}

/** Discard the current Session and return to the start. */
export async function restartInterview(): Promise<void> {
  await clearSessionIdCookie();
  redirect("/interview");
}
