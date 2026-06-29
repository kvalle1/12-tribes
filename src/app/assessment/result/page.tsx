import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { resolveHeadline } from "@/lib/assessment/result";
import { score } from "@/lib/assessment/score";
import { ResultView } from "../result-view";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * The full result (issue #6): the Primary (and qualifying Secondary) headline,
 * the ranked normalized scores for all 12 tribes, the words the Subject picked,
 * and links into the tribe profile page(s). Scoring runs here on the server (the
 * scoring core is `server-only`); only the computed scores are handed to the
 * presentational `ResultView`, which the same way serves both the post-submit and
 * the revisit path (they both land on this route).
 */
export default async function AssessmentResultPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/result")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const headline = resolveHeadline(row.primarySlug, row.secondarySlug);
  const scores = score(row.words);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <div className="mt-10">
          <ResultView headline={headline} scores={scores} words={row.words} />
        </div>
      </div>
    </main>
  );
}
