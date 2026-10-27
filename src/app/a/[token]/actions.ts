"use server";

import { redirect } from "next/navigation";
import { recordObserverResponse } from "@/lib/observer/repository";

/**
 * Server Action for an Observer submitting their read of a Subject (issue #8).
 * No sign-in: the Subject is identified solely by the opaque `token` from the
 * shareable link, bound to this action on the server. All validation and the
 * anonymous write happen server-side (ADR-0009); the client only posts the
 * selected words. An unknown token or out-of-range selection records nothing
 * and sends the Observer back to the form.
 */
export async function submitObserverResponse(
  token: string,
  formData: FormData,
): Promise<void> {
  const words = formData.getAll("words").map(String);

  const recorded = await recordObserverResponse(token, words);
  if (!recorded) redirect(`/a/${token}`);

  redirect(`/a/${token}/thanks`);
}
