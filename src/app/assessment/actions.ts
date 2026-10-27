"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { saveCurrentResult } from "@/lib/assessment/repository";

/**
 * Server Action for submitting the Self Assessment. All scoring and persistence
 * happen here on the server (ADR-0009); the client only posts the selected
 * words. Sign-in is required (ADR-0004) — an unauthenticated submit is bounced
 * through magic-link sign-in and back.
 */
export async function submitAssessment(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment")}`);
  }

  const words = formData.getAll("words").map(String);

  const saved = await saveCurrentResult(session.user.id, words);
  // Out-of-range or empty selections don't save; send the Subject back to retry.
  if (!saved) redirect("/assessment");

  redirect("/assessment/result");
}
