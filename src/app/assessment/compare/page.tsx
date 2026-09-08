import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { score } from "@/lib/assessment/score";
import { aggregateObservers, MIN_OBSERVERS } from "@/lib/observer/aggregate";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own read beside
 * the equal-weight aggregate of their anonymous observers.
 *
 * Login-gated like the rest of the assessment (ADR-0004): an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it. All scoring (self and the observer
 * aggregation) runs here on the server; only plain numbers reach the client.
 *
 * The report unlocks only once at least `MIN_OBSERVERS` observers have
 * responded — until then the Subject sees a clear locked state with how many
 * responses have come in, so an individual observer can never be singled out.
 */
export default async function ComparisonReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=${encodeURIComponent("/assessment/compare")}`,
    );
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponses(session.user.id);
  const aggregate = aggregateObservers(responses);

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
            selfPrimarySlug={row.primarySlug}
            selfSecondarySlug={row.secondarySlug}
          />
        ) : (
          <LockedReport count={aggregate.observerCount} />
        )}
      </div>
    </main>
  );
}

/**
 * The pre-unlock state: shown until at least `MIN_OBSERVERS` observers respond.
 * States plainly how many reads have arrived and how many are still needed, so
 * the Subject knows the report is coming without any individual observer being
 * revealed.
 */
function LockedReport({ count }: { count: number }) {
  const remaining = MIN_OBSERVERS - count;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        Not unlocked yet
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Your comparison opens once at least {MIN_OBSERVERS} people have shared
        how they see you. Waiting for three keeps every observer anonymous and
        makes the combined read meaningful.
      </p>

      <div className="mt-10 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Responses so far
        </p>
        <p className="mt-3 font-serif text-[40px] font-semibold leading-none">
          {count}
          <span className="text-[22px] text-faint"> / {MIN_OBSERVERS}</span>
        </p>
        <p className="mt-4 text-[15px] text-muted">
          {remaining === 1
            ? "Just one more response and your report unlocks."
            : `${remaining} more responses and your report unlocks.`}
        </p>
      </div>

      <div className="mt-12 border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Share your observer link again
        </Link>
      </div>
    </div>
  );
}
