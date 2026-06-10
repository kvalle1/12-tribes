"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { interviewSessions } from "@/db/schema";
import {
  INTERVIEW_SESSION_COOKIE,
  initialState,
  recordAnswer,
  type InterviewState,
} from "@/lib/interview/session";

/**
 * Server-authoritative interview actions (ADR-0009). The browser only ever
 * sends a free-text answer; the Session id lives in an httpOnly cookie and the
 * scoring state lives in Postgres, so the client cannot read or mutate it.
 * Every Turn is persisted (ADR-0011) so a refresh resumes in place.
 */

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  // The skeleton interview is short-lived; a week is ample for a resume.
  maxAge: 60 * 60 * 24 * 7,
};

/** Start (or restart) an interview: create a Session row and remember it. */
export async function startInterview() {
  const session = await auth();
  // Tie to the signed-in account when there is one; anonymous is fine here.
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

  const init = initialState();
  const [row] = await db
    .insert(interviewSessions)
    .values({
      userId,
      turns: init.turns,
      turnCount: init.turnCount,
      status: init.status,
    })
    .returning({ id: interviewSessions.id });

  const jar = await cookies();
  jar.set(INTERVIEW_SESSION_COOKIE, row.id, COOKIE_OPTIONS);

  redirect("/interview");
}

/** Record the participant's answer to the current question and advance. */
export async function submitAnswer(formData: FormData) {
  const answer = String(formData.get("answer") ?? "").trim();

  const jar = await cookies();
  const id = jar.get(INTERVIEW_SESSION_COOKIE)?.value;
  if (!id) redirect("/interview");

  const [row] = await db
    .select()
    .from(interviewSessions)
    .where(eq(interviewSessions.id, id));

  // Cookie points at a Session that no longer exists — drop it and restart.
  if (!row) {
    jar.delete(INTERVIEW_SESSION_COOKIE);
    redirect("/interview");
  }

  // Ignore empty submissions rather than persisting a blank Turn.
  if (!answer) redirect("/interview");

  const current: InterviewState = {
    turns: row.turns,
    turnCount: row.turnCount,
    status: row.status,
  };
  const next = recordAnswer(current, answer);

  await db
    .update(interviewSessions)
    .set({
      turns: next.turns,
      turnCount: next.turnCount,
      status: next.status,
      updatedAt: new Date(),
    })
    .where(eq(interviewSessions.id, id));

  redirect(next.status === "complete" ? "/interview/result" : "/interview");
}
