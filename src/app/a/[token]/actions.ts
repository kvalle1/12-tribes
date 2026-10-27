"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { recordObserverResponse } from "@/lib/observer/repository";
import { observerCookieName } from "@/lib/observer/anti-abuse";

/**
 * Server Action for an Observer submitting their read of a Subject (issue #8).
 * No sign-in: the Subject is identified solely by the opaque `token` from the
 * shareable link, bound to this action on the server. All validation and the
 * anonymous write happen server-side (ADR-0009); the client only posts the
 * selected words. An unknown token or out-of-range selection records nothing
 * and sends the Observer back to the form.
 *
 * Two anti-abuse guards keep the ≥3 unlock gate from being self-seeded by one
 * person (issue #193), without persisting any identity on the anonymous row:
 *  - a per-browser "already responded" cookie, so reloading the link and
 *    resubmitting from the same browser doesn't pad the count; and
 *  - passing the signed-in visitor's id down to `recordObserverResponse`, which
 *    refuses a submission from the Subject about themselves.
 */
export async function submitObserverResponse(
  token: string,
  formData: FormData,
): Promise<void> {
  const words = formData.getAll("words").map(String);

  const jar = await cookies();
  const cookieName = observerCookieName(token);

  // This browser has already responded to this link: don't double-count. Treat
  // it as done rather than silently recording a second read.
  if (jar.get(cookieName)) redirect(`/a/${token}/thanks`);

  const session = await auth();
  const submitterUserId = session?.user?.id ?? null;

  const recorded = await recordObserverResponse(token, words, submitterUserId);
  if (!recorded) redirect(`/a/${token}`);

  // Mark this browser as having responded. The cookie is an opaque one-response
  // marker scoped to this link — no identity, nothing tying the browser to the
  // read it just left.
  jar.set(cookieName, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/a/${token}`,
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect(`/a/${token}/thanks`);
}
