"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isSubmittable, normalizeSelection } from "@/lib/assessment/selection";
import { saveCurrentResult } from "@/lib/assessment/repository";

/** Where an unauthenticated visitor is sent before the assessment, and returns to after. */
const ASSESSMENT_PATH = "/assessment";
const SIGNIN_REDIRECT = `/signin?callbackUrl=${encodeURIComponent(ASSESSMENT_PATH)}`;

/**
 * Record the Subject's selected words as their current result.
 *
 * Authentication is required (ADR-0004): an unauthenticated submission is sent
 * through magic-link sign-in. The selection is normalized and re-validated
 * server-side — the client gates submission to 8–15 words, but the server never
 * trusts the client. On success the words are scored and saved (overwriting any
 * prior result) and the Subject is sent to their result.
 */
export async function submitAssessment(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(SIGNIN_REDIRECT);
  }

  const words = normalizeSelection(formData.getAll("words").map(String));
  if (!isSubmittable(words.length)) {
    // The client gate was bypassed — send the Subject back to re-pick.
    redirect(ASSESSMENT_PATH);
  }

  await saveCurrentResult(session.user.id, words);
  redirect("/assessment/result");
}
