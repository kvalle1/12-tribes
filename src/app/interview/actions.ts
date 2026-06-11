"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  createSession,
  loadSession,
  saveSession,
} from "@/lib/interview/session-repository";
import { isComplete, recordAnswer } from "@/lib/interview/skeleton";

/**
 * Server Actions for the Interview walking skeleton (issue #14).
 *
 * The active Session is tracked by an httpOnly cookie holding only the opaque
 * Session id — never any scoring state. All state lives server-side in Postgres
 * (ADR-0009). Each Turn is persisted before responding so a refresh resumes
 * exactly where the participant left off (ADR-0011).
 */

const SESSION_COOKIE = "interview_session";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};

/** Begin a new Interview: create the server-side Session, then show the first Turn. */
export async function startInterview(): Promise<void> {
  const session = await auth();
  const id = await createSession(session?.user?.id);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, id, cookieOptions);

  redirect("/interview");
}

/** Record the participant's answer to the current Turn and advance the Session. */
export async function submitAnswer(formData: FormData): Promise<void> {
  const cookieStore = await cookies();
  const id = cookieStore.get(SESSION_COOKIE)?.value;
  if (!id) {
    redirect("/interview");
  }

  const state = await loadSession(id);
  if (!state) {
    // The cookie points at a Session that no longer exists; start over.
    cookieStore.delete(SESSION_COOKIE);
    redirect("/interview");
  }

  // Already finished — nothing to record; send them to their result.
  if (isComplete(state)) {
    redirect("/interview/result");
  }

  const answer = String(formData.get("answer") ?? "").trim();
  if (!answer) {
    // Empty submission: re-render the same Turn rather than persisting a blank.
    redirect("/interview");
  }

  const next = recordAnswer(state, answer);
  await saveSession(id, next);

  redirect(isComplete(next) ? "/interview/result" : "/interview");
}
