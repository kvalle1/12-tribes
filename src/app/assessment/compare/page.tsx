import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { observerShareUrl } from "@/lib/observer/link";
import {
  aggregateObservers,
  hasEnoughObservers,
  OBSERVER_UNLOCK_THRESHOLD,
} from "@/lib/observer/aggregate";
import { score } from "@/lib/assessment/score";
import { ComparisonReport } from "@/components/comparison-report";
import { ObserverShareLink } from "@/components/observer-share-link";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile
 * alongside the equal-weight average of their anonymous observers, with an
 * anonymous per-observer drill-down.
 *
 * Login-gated (it is the Subject's own report). It unlocks only once at least
 * three observers have responded — before then it shows a clear locked state
 * with the share link so the Subject can gather the reads it needs. All scoring
 * (self and the observer aggregation) runs here on the server; only plain score
 * data is handed to the presentational report (ADR-0009 trust boundary).
 */
export default async function ComparePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=${encodeURIComponent("/assessment/compare")}`,
    );
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponses(session.user.id);
  const others = aggregateObservers(responses);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        {hasEnoughObservers(others.count) ? (
          <ComparisonReport
            self={score(row.words)}
            others={others.average}
            observers={others.observers}
            primarySlug={row.primarySlug}
            secondarySlug={row.secondarySlug}
          />
        ) : (
          <LockedState
            count={others.count}
            shareUrl={await observerShareUrl(row.shareToken)}
          />
        )}
      </div>
    </main>
  );
}

/**
 * Shown until at least three observers have responded (ADR-0003). Makes the
 * threshold and progress explicit and re-surfaces the share link so the Subject
 * can gather the remaining reads.
 */
function LockedState({ count, shareUrl }: { count: number; shareUrl: string }) {
  const remaining = OBSERVER_UNLOCK_THRESHOLD - count;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Comparison report
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        Not unlocked yet
      </h1>
      <p className="mt-5 max-w-[540px] text-[15px] leading-relaxed text-muted">
        {count === 0
          ? "No one has responded yet."
          : `${count} of ${OBSERVER_UNLOCK_THRESHOLD} people have responded.`}{" "}
        The comparison unlocks once at least {OBSERVER_UNLOCK_THRESHOLD} people
        respond — enough for the average to mean something and to keep each
        response anonymous. {remaining} more to go.
      </p>

      {/* Progress toward the unlock threshold. */}
      <div
        className="mt-8 flex gap-2"
        role="img"
        aria-label={`${count} of ${OBSERVER_UNLOCK_THRESHOLD} observer responses received`}
      >
        {Array.from({ length: OBSERVER_UNLOCK_THRESHOLD }, (_, i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full ${
              i < count ? "bg-gold" : "bg-hair"
            }`}
          />
        ))}
      </div>

      <section className="mt-12 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Send your link
        </p>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          Share this with 3–5 people who know you well. Each one anonymously picks
          the words that describe you.
        </p>
        <ObserverShareLink url={shareUrl} />
      </section>
    </div>
  );
}
