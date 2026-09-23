import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { ResultView } from "@/components/result-view";

/**
 * The Subject's profile — a stable place that represents their tribe (PRD story
 * 17). It shows the Account's single current result (ADR-0004) via the shared
 * `ResultView` (issue #6), the same view used right after submitting and when
 * revisiting the saved result, so the profile can never drift from it.
 *
 * Login-gated like the rest of the assessment flow: an unauthenticated visitor is
 * routed through magic-link sign-in and returned here, and a signed-in user who
 * hasn't taken the assessment yet is sent to start it. Reading the session opts
 * this route into dynamic rendering, which is what keys the result to the Account.
 */
export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/profile")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <ResultView
          words={row.words}
          primarySlug={row.primarySlug}
          secondarySlug={row.secondarySlug}
        />
      </div>
    </main>
  );
}
