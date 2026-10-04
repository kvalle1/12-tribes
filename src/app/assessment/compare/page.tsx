import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { score } from "@/lib/assessment/score";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverWordLists } from "@/lib/observer/repository";
import {
  aggregateObservers,
  isReportUnlocked,
  OBSERVER_UNLOCK_THRESHOLD,
} from "@/lib/observer/aggregate";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003).
 *
 * Login-gated like the rest of the Self flow: a signed-out visitor routes
 * through sign-in, and a signed-in user who hasn't taken the assessment is sent
 * to start it (there's no "self" to compare against otherwise). All scoring and
 * aggregation run here on the server — the client component only ever receives
 * pre-computed, plain score data (ADR-0009).
 *
 * The report unlocks only once at least {@link OBSERVER_UNLOCK_THRESHOLD}
 * Observers have responded, so the aggregate is meaningful and no single
 * Observer can be singled out. Before then the page shows a clear locked state
 * with how many responses are in.
 */
export default async function ComparisonReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/compare")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const wordLists = await getObserverWordLists(session.user.id);
  const aggregate = aggregateObservers(wordLists);
  const unlocked = isReportUnlocked(aggregate.observerCount);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        {unlocked ? (
          <ComparisonReport
            self={score(row.words)}
            others={aggregate.average}
            perObserver={aggregate.perObserver}
          />
        ) : (
          <LockedState observerCount={aggregate.observerCount} />
        )}
      </div>
    </main>
  );
}

/**
 * The pre-unlock state: a clear explanation that the report opens at three
 * responses and how many are in so far. Shows a count only — never who
 * responded — so Observers stay anonymous even before the unlock.
 */
function LockedState({ observerCount }: { observerCount: number }) {
  const remaining = OBSERVER_UNLOCK_THRESHOLD - observerCount;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        The 360 read
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,54px)] font-semibold leading-[1.05]">
        Not unlocked yet
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        Your comparison opens once at least {OBSERVER_UNLOCK_THRESHOLD} people
        have answered. That keeps the &ldquo;others&rdquo; view meaningful and
        every responder anonymous.
      </p>

      <div className="mt-10 rounded-[2px] border border-hair p-6">
        <div className="text-[12px] uppercase tracking-[0.16em] text-faint">
          Responses so far
        </div>
        <div className="mt-2 font-serif text-[40px] font-semibold leading-none">
          {observerCount}
          <span className="text-[22px] text-muted">
            {" "}
            / {OBSERVER_UNLOCK_THRESHOLD}
          </span>
        </div>
        <p className="mt-4 text-[15px] text-muted">
          {remaining === 1
            ? "Just one more response and your report unlocks."
            : `${remaining} more responses and your report unlocks.`}
        </p>
      </div>

      <div className="mt-10 border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Back to your result to share your link
        </Link>
      </div>
    </div>
  );
}
