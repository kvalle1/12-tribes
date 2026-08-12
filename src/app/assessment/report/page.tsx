import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { score } from "@/lib/assessment/score";
import { getObserverResponses } from "@/lib/observer/repository";
import { aggregateObservers } from "@/lib/observer/aggregate";
import { MIN_OBSERVERS, isReportUnlocked } from "@/lib/observer/constants";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). Login-gated
 * like the rest of the Self flow; a signed-in user who hasn't taken the
 * assessment is sent to start it, since there's no self profile to compare
 * against yet.
 *
 * The report unlocks only once at least {@link MIN_OBSERVERS} Observers have
 * responded — before then it shows a clear locked state with progress, so the
 * "others" view is meaningful and no individual Observer can be singled out.
 * Both the self profile and the equal-weight "others" profile are computed
 * here on the server (the scoring core is `server-only`); the report component
 * receives only plain scored numbers.
 */
export default async function ComparisonReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
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

        {isReportUnlocked(aggregate.count) ? (
          <ComparisonReport
            self={score(row.words)}
            others={aggregate.others}
            perObserver={aggregate.perObserver}
            observerCount={aggregate.count}
          />
        ) : (
          <LockedReport count={aggregate.count} />
        )}
      </div>
    </main>
  );
}

/**
 * The locked state shown before enough Observers have responded. It names how
 * many more are needed and points back to the result page, where the shareable
 * invite link lives — so the Subject's next step (invite more people) is clear.
 */
function LockedReport({ count }: { count: number }) {
  const remaining = MIN_OBSERVERS - count;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 reflection
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,52px)] font-semibold leading-[1.05]">
        Not enough reflections yet
      </h1>
      <p className="mt-4 max-w-[520px] text-[16px] text-muted">
        The comparison unlocks once at least {MIN_OBSERVERS} people have shared
        their read — enough that the &ldquo;others&rdquo; view is meaningful and
        no single response can be singled out.
      </p>

      <div className="mt-10 rounded-[2px] border border-hair p-6">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-[40px] leading-none text-gold">
            {count}
          </span>
          <span className="text-[15px] text-muted">
            of {MIN_OBSERVERS} responses in
          </span>
        </div>
        <div
          className="mt-4 h-2 overflow-hidden rounded-full bg-hair/50"
          role="img"
          aria-label={`${count} of ${MIN_OBSERVERS} observer responses received`}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{ width: `${(count / MIN_OBSERVERS) * 100}%` }}
          />
        </div>
        <p className="mt-4 text-[15px] text-ink">
          {remaining === 1
            ? "Just one more response and your report unlocks."
            : `${remaining} more responses and your report unlocks.`}
        </p>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-[22px]">
        <Link
          href="/assessment/result"
          className="rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
        >
          Get your invite link
        </Link>
        <Link
          href="/"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Back to Tribe·Index
        </Link>
      </div>
    </div>
  );
}
