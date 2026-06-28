"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { saveCurrentResult } from "@/lib/assessment/result-repository";
import { isSubmittable, sanitizeSelection } from "@/lib/assessment/selection";

/**
 * Submit a Self Assessment: score the selection with the pure scoring core and
 * save it as the Account's current result (overwriting any prior one, ADR-0004).
 *
 * Auth is required and re-checked here — the client is never trusted. The
 * selection is sanitized (unknown words and duplicates dropped) and the 8–15
 * range re-validated server-side before anything is scored or persisted.
 */
export async function submitAssessment(words: string[]): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/assessment");
  }

  const selection = sanitizeSelection(words);
  if (!isSubmittable(selection.length)) {
    // The UI gates the count; reaching here means a malformed request — restart.
    redirect("/assessment");
  }

  await saveCurrentResult(session.user.id, selection);
  redirect("/assessment/result");
}
