"use server";

import { redirect } from "next/navigation";
import { recordAnswer, startSession } from "@/lib/interview/flow";
import { interviewRepository } from "@/lib/interview/server";
import { readSessionId, writeSessionId } from "@/lib/interview/session-cookie";

/**
 * Server Actions for the Interview's walking skeleton. These own the Session —
 * the client only triggers them and posts free-text answers; it never sees or
 * mutates scoring state (ADR-0009). Server Actions run as POST requests, so all
 * mutations and cookie writes happen here rather than during page render.
 */

/** Start a new Interview: create the server Session, point the cookie at it. */
export async function startInterview(): Promise<void> {
  const session = startSession(crypto.randomUUID());
  await interviewRepository.create(session);
  await writeSessionId(session.id);
  redirect("/interview/active");
}

/** Record the answer to the current Turn and advance to the next state. */
export async function submitAnswer(formData: FormData): Promise<void> {
  const id = await readSessionId();
  if (!id) redirect("/interview");

  const session = await interviewRepository.load(id);
  if (!session) redirect("/interview");
  if (session.status === "complete") redirect("/interview/result");

  const answer = String(formData.get("answer") ?? "");
  // Re-prompt the same Turn on an empty submission rather than recording it.
  if (!answer.trim()) redirect("/interview/active");

  const advanced = recordAnswer(session, answer);
  await interviewRepository.save(advanced);

  redirect(
    advanced.status === "complete" ? "/interview/result" : "/interview/active",
  );
}
