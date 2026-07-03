import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverWordLists } from "@/lib/observer/repository";
import { score } from "@/lib/assessment/score";
import {
  MIN_OBSERVERS,
  aggregateObservers,
  compareProfiles,
  isReportUnlocked,
  scoreEachObserver,
} from "@/lib/assessment/aggregateObservers";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 comparison report (issue #9, ADR-0003) — the self-vs-others view that
 * closes the 360 loop. Login-gated like the rest of the assessment: an
 * unauthenticated visitor is routed through sign-in, and a signed-in user who
 * hasn't taken the assessment is sent to start it (there's no "others" to
 * compare against without a Subject profile).
 *
 * The report unlocks only once at least `MIN_OBSERVERS` (3) people have
 * responded — below that the "others" view is statistically thin and could
 * de-anonymize individual Observers, so a clear locked state shows progress
 * instead. All scoring and the equal-weight aggregation happen here on the
 * server; the client receives only computed scores.
 */
export default async function ComparisonReportPage() {
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
            comparison={compareProfiles(
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
 * Shown until at least `MIN_OBSERVERS` people have responded: a clear,
 * non-empty locked state that reports progress toward the unlock rather than a
 * bare "come back later".
 */
function LockedState({ observerCount }: { observerCount: number }) {
  const remaining = MIN_OBSERVERS - observerCount;
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-2 font-serif text-[clamp(34px,6vw,54px)] font-semibold leading-[1.04]">
        Not unlocked yet
      </h1>
      <p className="mt-4 max-w-[540px] text-[15px] text-muted">
        Your comparison unlocks once at least {MIN_OBSERVERS} people have
        described you. This keeps the &ldquo;others&rdquo; read meaningful and
        each response anonymous.
      </p>

      <div className="mt-10 flex items-center gap-4">
        <span className="font-serif text-[40px] leading-none text-gold">
          {observerCount}
        </span>
        <span className="text-[14px] text-muted">
          of {MIN_OBSERVERS} responses so far
          {remaining > 0 && (
            <>
              {" "}
              — {remaining} more to go
            </>
          )}
        </span>
      </div>

      {/* Progress toward the unlock threshold. */}
      <div
        className="mt-6 h-2.5 w-full max-w-[320px] overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${observerCount} of ${MIN_OBSERVERS} observer responses`}
      >
        <div
          className="h-full rounded-full bg-gold transition-[width]"
          style={{
            width: `${Math.min((observerCount / MIN_OBSERVERS) * 100, 100)}%`,
          }}
        />
      </div>

      <p className="mt-10 max-w-[540px] text-[15px] text-muted">
        Share your observer link from your{" "}
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-0.5 text-ink transition-colors hover:text-gold"
        >
          result page
        </Link>{" "}
        to gather more reads.
      </p>
    </div>
  );
}
