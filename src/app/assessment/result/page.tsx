import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { resolveHeadline, rankTribeScores } from "@/lib/assessment/result";
import { score } from "@/lib/assessment/score";
import { ResultView } from "./result-view";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it. This page is reached both right after
 * submitting and when a Subject returns to their result, so it renders the same
 * view in both cases.
 *
 * Scoring runs here on the server from the saved words, so the full 12-tribe
 * spectrum is recomputed without the word→tribe mapping ever reaching the client
 * (ADR-0009). The headline tribes come from the stored slugs, keeping the named
 * Primary/Secondary identical to what was saved.
 */
export default async function AssessmentResultPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/result")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const headline = resolveHeadline(row.primarySlug, row.secondarySlug);
  const scores = rankTribeScores(score(row.words));

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <ResultView headline={headline} scores={scores} words={row.words} />

        <div className="mt-14 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
          <Link
            href="/assessment"
            className="rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
          >
            Retake the assessment
          </Link>
          <Link
            href={`/tribes/${headline.primary.slug}`}
            className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
          >
            Read the full {headline.primary.name} profile
          </Link>
        </div>
      </div>
    </main>
  );
}
