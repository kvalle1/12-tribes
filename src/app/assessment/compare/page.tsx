import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { score } from "@/lib/assessment/score";
import {
  getObserverWordsForSubject,
} from "@/lib/observer/repository";
import {
  aggregateObservers,
  OBSERVER_UNLOCK_THRESHOLD,
} from "@/lib/observer/aggregate";
import { observerShareUrl } from "@/lib/observer/link";
import { ComparisonReport } from "@/components/comparison-report";
import { ObserverShareLink } from "@/components/observer-share-link";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own Strength
 * Profile beside the equal-weight "others" profile built from their anonymous
 * Observers, the tribes where the two views diverge, and a per-observer
 * drill-down.
 *
 * Login-gated and scoped to the signed-in Subject's own result. The report
 * unlocks only once at least `OBSERVER_UNLOCK_THRESHOLD` (3) observers have
 * responded; before then it shows a clear locked state with the share link so
 * the Subject can gather the rest. Scoring and aggregation run here on the
 * server (ADR-0009); only computed numbers are handed to the view.
 */
export default async function ComparePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/compare")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const observerWords = await getObserverWordsForSubject(session.user.id);
  const aggregate = aggregateObservers(observerWords);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        {aggregate.unlocked ? (
          <ComparisonReport
            self={score(row.words)}
            others={aggregate.others}
            perObserver={aggregate.perObserver}
          />
        ) : (
          <LockedState
            observerCount={aggregate.observerCount}
            shareUrl={await observerShareUrl(row.shareToken)}
          />
        )}
      </div>
    </main>
  );
}

/**
 * Shown until at least `OBSERVER_UNLOCK_THRESHOLD` Observers have responded.
 * States plainly how many have answered and how many more are needed, and keeps
 * the share link in reach so the Subject can close the gap.
 */
function LockedState({
  observerCount,
  shareUrl,
}: {
  observerCount: number;
  shareUrl: string;
}) {
  const remaining = OBSERVER_UNLOCK_THRESHOLD - observerCount;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        The 360 read · locked
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        A few more voices to go
      </h1>
      <p className="mt-5 max-w-[560px] text-[16px] leading-relaxed text-muted">
        Your comparison report unlocks once at least{" "}
        {OBSERVER_UNLOCK_THRESHOLD} people have described you — enough for the
        combined read to mean something, and enough to keep every observer
        anonymous.
      </p>

      <div className="mt-10 flex items-center gap-4">
        <span className="font-serif text-[44px] leading-none text-gold">
          {observerCount}
        </span>
        <span className="text-[15px] text-muted">
          of {OBSERVER_UNLOCK_THRESHOLD} responses so far
          <br />
          <span className="text-faint">
            {remaining} more {remaining === 1 ? "voice" : "voices"} needed
          </span>
        </span>
      </div>

      {/* Progress rail */}
      <div className="mt-6 flex gap-2" aria-hidden>
        {Array.from({ length: OBSERVER_UNLOCK_THRESHOLD }).map((_, i) => (
          <div
            key={i}
            className={
              "h-1.5 flex-1 rounded-full " +
              (i < observerCount ? "bg-gold" : "bg-hair/60")
            }
          />
        ))}
      </div>

      <section className="mt-12 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Share your link
        </p>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          Send this to 3–5 people who know you well. Each anonymously picks the
          words that describe you.
        </p>
        <ObserverShareLink url={shareUrl} />
      </section>
    </div>
  );
}
