"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createSession, loadSession, saveSession } from "./repository";
import { SESSION_COOKIE, createInitialSession, recordAnswer } from "./session";

/**
 * Server Actions driving the server-authoritative Interview loop (ADR-0009).
 *
 * The client never holds or sends scoring state: it submits only the free-text
 * answer, and the session is identified by an httpOnly cookie holding an opaque
 * id (not state). All session state lives in Postgres and is written every Turn
 * for resume (ADR-0011).
 */

async function setSessionCookie(id: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    // ~7 days; long enough to resume a multi-minute interview later.
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function startInterview(): Promise<void> {
  // Link to the account model when signed in, but don't require it (ADR-0011).
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const id = await createSession(createInitialSession(), userId);
  await setSessionCookie(id);

  redirect("/interview");
}

export async function submitAnswer(formData: FormData): Promise<void> {
  // Only the answer comes from the client; the session id comes from the cookie.
  const answer = String(formData.get("answer") ?? "");

  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (!id) {
    redirect("/interview");
  }

  const current = await loadSession(id);
  if (!current || current.status === "complete") {
    redirect("/interview/result");
  }

  const next = recordAnswer(current, answer);
  await saveSession(id, next);

  redirect(next.status === "complete" ? "/interview/result" : "/interview");
}
