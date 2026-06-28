"use server";

import { redirect } from "next/navigation";
import { recordObserverResponse } from "@/lib/assessment/observers";

/**
 * Server Action for an anonymous 360 Observer submission (issue #8). The token
 * identifies the Subject being described and rides along as a hidden form field;
 * scoring/persistence stay on the server (ADR-0009). No sign-in is required — an
 * Observer is intentionally anonymous (ADR-0003).
 *
 * An unknown token or an out-of-range selection sends the Observer back to the
 * link to retry; a recorded response lands on the thank-you page.
 */
export async function submitObserverResponse(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const words = formData.getAll("words").map(String);

  const outcome = await recordObserverResponse(token, words);
  if (outcome !== "ok") redirect(`/a/${encodeURIComponent(token)}`);

  redirect(`/a/${encodeURIComponent(token)}/thanks`);
}
