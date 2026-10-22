import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { score } from "@/lib/assessment/score";
import { aggregateObservers } from "@/lib/observer/aggregate";
import { compareProfiles } from "@/lib/observer/compare";
import {
  OBSERVER_UNLOCK_THRESHOLD,
  isReportUnlocked,
} from "@/lib/observer/constants";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile
 * against the equal-weight aggregate of how their anonymous Observers see them.
 *
 * Login-gated and Subject-only — it reads the signed-in user's own result and
 * their observer responses; there is no way to view anyone else's. The report
 * unlocks only once at least `OBSERVER_UNLOCK_THRESHOLD` Observers have responded
 * (so no single Observer is exposed and the "others" view carries real signal);
 * before then a locked state shows how many more responses are needed.
 *
 * Server component: it calls the `server-only` scoring core and aggregation, and
 * passes only the computed numbers to the presentational `ComparisonReport`.
 */
export default async function ComparisonReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponses(session.user.id);
  const observerCount = responses.length;
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

        {isReportUnlocked(observerCount) ? (
          <ComparisonReport
            comparison={compareProfiles(score(row.words), others.scores)}
            perObserver={others.perObserver}
            observerCount={observerCount}
          />
        ) : (
          <LockedReport observerCount={observerCount} />
        )}
      </div>
    </main>
  );
}

/**
 * The pre-unlock state: how others see you stays sealed until enough people have
 * answered, both to keep individual Observers anonymous and because a one- or
 * two-person "average" is noise, not a read.
 */
function LockedReport({ observerCount }: { observerCount: number }) {
  const remaining = OBSERVER_UNLOCK_THRESHOLD - observerCount;
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Comparison report
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        Still gathering
      </h1>
      <p className="mt-5 max-w-[540px] text-[16px] text-muted">
        {observerCount === 0
          ? "No one has answered yet."
          : observerCount === 1
            ? "One person has answered so far."
            : `${observerCount} people have answered so far.`}{" "}
        Your comparison unlocks once{" "}
        <strong className="font-semibold text-ink">
          {OBSERVER_UNLOCK_THRESHOLD} observers
        </strong>{" "}
        have responded — that keeps each answer anonymous and the &ldquo;others&rdquo;
        view meaningful.
      </p>

      <div className="mt-8 flex items-center gap-4">
        <div
          className="h-2.5 w-full max-w-[280px] overflow-hidden rounded-full bg-hair/50"
          role="img"
          aria-label={`${observerCount} of ${OBSERVER_UNLOCK_THRESHOLD} observers responded`}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{
              width: `${Math.min(
                (observerCount / OBSERVER_UNLOCK_THRESHOLD) * 100,
                100,
              )}%`,
            }}
          />
        </div>
        <span className="shrink-0 text-[13px] tabular-nums text-faint">
          {observerCount} / {OBSERVER_UNLOCK_THRESHOLD}
        </span>
      </div>

      <p className="mt-8 max-w-[540px] text-[15px] text-muted">
        {remaining === 1
          ? "One more response and it opens."
          : `${remaining} more responses and it opens.`}{" "}
        Share your observer link from{" "}
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-0.5 text-ink transition-colors hover:text-gold"
        >
          your result page
        </Link>
        .
      </p>
    </div>
  );
}
