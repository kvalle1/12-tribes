import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { aggregateObservers } from "@/lib/observer/aggregate";
import { observerLink } from "@/lib/observer/link";
import { ResultView } from "@/components/result-view";
import { ObserverShareLink } from "@/components/observer-share-link";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * The result is rendered by the shared `ResultView` (issue #6) — the same view
 * shown right after submitting and when revisiting the saved result, and reused
 * by the profile page (#18). It shows the Primary/Secondary headline, the
 * twelve-tribe ranking bars, the chosen words, and links into the full profiles.
 * Below it, the Subject can share a 360 observer link (issue #8).
 */
export default async function AssessmentResultPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/result")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  // Compose the absolute observer link (prefers the trusted configured origin).
  const shareUrl = await observerLink(row.shareToken);

  // How many people have weighed in so far, so the CTA can point to the
  // comparison report once it has unlocked (≥3 responses, issue #9).
  const { observerCount, unlocked } = aggregateObservers(
    await getObserverResponses(session.user.id),
  );

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

        <section className="mt-14 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Get a 360 read
          </p>
          <h2 className="mt-2 font-serif text-[22px] font-semibold leading-snug">
            See how others see you
          </h2>
          <p className="mt-2 max-w-[520px] text-[15px] text-muted">
            Send this link to 3–5 people who know you well. Each one anonymously
            picks the words that describe you, and once at least three respond
            you&rsquo;ll see how their read compares with your own.
          </p>
          <ObserverShareLink url={shareUrl} />

          <p className="mt-6 text-[14px] text-muted">
            {unlocked ? (
              <Link
                href="/report"
                className="border-b border-gold pb-1 text-ink transition-colors hover:text-gold"
              >
                View your comparison report →
              </Link>
            ) : (
              <>
                {observerCount === 0
                  ? "No responses yet."
                  : `${observerCount} of 3 responses in.`}{" "}
                Your comparison report unlocks once three people have responded.
              </>
            )}
          </p>
        </section>
      </div>
    </main>
  );
}
