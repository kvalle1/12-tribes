import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverWordLists } from "@/lib/observer/repository";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  compareProfiles,
  isReportUnlocked,
  scoreEachObserver,
  MIN_OBSERVERS,
} from "@/lib/assessment/aggregateObservers";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile
 * against the equal-weight aggregated "others" profile, with anonymous
 * per-observer drill-down.
 *
 * Login-gated — the report is only ever the signed-in Subject's own. It unlocks
 * only once at least `MIN_OBSERVERS` (3) people have responded, so the "others"
 * view stays meaningful and no single Observer can be singled out; before then a
 * clear locked state shows progress toward the threshold.
 *
 * All scoring happens here on the server via the `server-only` aggregation core;
 * only plain computed numbers are handed to the client component.
 */
export default async function AssessmentReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const observerWordLists = await getObserverWordLists(session.user.id);
  const observerCount = observerWordLists.length;

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
            comparisons={compareProfiles(
              score(row.words),
              aggregateObservers(observerWordLists),
            )}
            perObserver={scoreEachObserver(observerWordLists)}
          />
        ) : (
          <LockedState observerCount={observerCount} />
        )}
      </div>
    </main>
  );
}

/**
 * Shown until at least `MIN_OBSERVERS` observers have responded. Communicates
 * how many more reads are needed and reassures the Subject the threshold exists
 * to keep individual Observers anonymous.
 */
function LockedState({ observerCount }: { observerCount: number }) {
  const remaining = MIN_OBSERVERS - observerCount;
  const pct = Math.min(100, (observerCount / MIN_OBSERVERS) * 100);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,6vw,54px)] font-semibold leading-[1.05]">
        Waiting on a few more voices
      </h1>
      <p className="mt-4 max-w-[540px] text-[15px] text-muted">
        Your comparison report unlocks once at least {MIN_OBSERVERS} people have
        described you. That keeps the &ldquo;others&rdquo; view meaningful and
        keeps every individual observer anonymous.
      </p>

      <div className="mt-10">
        <div className="flex items-baseline justify-between text-[12px] uppercase tracking-[0.14em] text-faint">
          <span>
            {observerCount} of {MIN_OBSERVERS} responded
          </span>
          <span>
            {remaining} more to go
          </span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-hair/50">
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <p className="mt-10 max-w-[540px] text-[15px] text-muted">
        Haven&rsquo;t shared your link yet? You&rsquo;ll find it on your result
        page — send it to 3–5 people who know you well.
      </p>

      <div className="mt-12 border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Get your observer link
        </Link>
      </div>
    </div>
  );
}
