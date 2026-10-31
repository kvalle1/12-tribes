"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  getSubjectByToken,
  recordObserverResponse,
} from "@/lib/observer/repository";
import {
  observerResponseCookieName,
  observerSubmissionRejection,
} from "@/lib/observer/submission-guard";

/**
 * Server Action for an Observer submitting their read of a Subject (issue #8).
 * No sign-in is required to respond: the Subject is identified solely by the
 * opaque `token` from the shareable link, bound to this action on the server.
 * All validation and the anonymous write happen server-side (ADR-0009); the
 * client only posts the selected words.
 *
 * Before recording, two guards (issue #193) keep the ≥3-response unlock gate
 * (#9) from being self-unlocked, without storing any observer identity:
 *  - a signed-in viewer who *is* the Subject can't submit against their own link;
 *  - a browser that already recorded a read for this link is turned away.
 * An unknown token or out-of-range selection records nothing and returns the
 * Observer to the form.
 */
export async function submitObserverResponse(
  token: string,
  formData: FormData,
): Promise<void> {
  const words = formData.getAll("words").map(String);

  const subject = await getSubjectByToken(token);
  if (!subject) redirect(`/a/${token}`);

  const session = await auth();
  const cookieStore = await cookies();
  const cookieName = observerResponseCookieName(token);

  const rejection = observerSubmissionRejection({
    viewerUserId: session?.user?.id,
    subjectId: subject.subjectId,
    alreadyRespondedFromBrowser: cookieStore.has(cookieName),
  });
  if (rejection === "self") redirect(`/a/${token}`);
  // A browser that already responded has a read on file — send it to the same
  // confirmation rather than looping it back through the form.
  if (rejection === "duplicate") redirect(`/a/${token}/thanks`);

  // Reuse the Subject already resolved above so the write doesn't look it up a
  // second time for the same token.
  const recorded = await recordObserverResponse(token, words, subject);
  if (!recorded) redirect(`/a/${token}`);

  // Mark this browser as having responded for this link. Scoped to the link's
  // own path and set only after a successful write, it holds nothing but a flag.
  cookieStore.set(cookieName, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/a/${token}`,
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect(`/a/${token}/thanks`);
}
