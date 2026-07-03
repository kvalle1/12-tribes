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
 * The 360 comparison report (issue #9, ADR-0003). Login-gated: an
 * unauthenticated visitor is routed through sign-in, and a signed-in user who
 * hasn't taken the assessment is sent to start it (there is nothing to compare
 * against, and no observer link would exist yet).
 *
 * All scoring happens here on the server — the `server-only` scoring core and
 * the equal-weight aggregation never reach the client. The report stays locked
 * until at least `MIN_OBSERVERS` Observers have responded, so the "others" view
 * is meaningful and no single Observer can be singled out.
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
            observers={scoreEachObserver(observerWordLists)}
            primarySlug={row.primarySlug}
          />
        ) : (
          <LockedState count={observerCount} />
        )}
      </div>
    </main>
  );
}

/**
 * Shown until at least `MIN_OBSERVERS` Observers respond. Reports concrete
 * progress ("2 of 3") so the Subject knows exactly how many more responses
 * unlock the report, and points them back to the share link.
 */
function LockedState({ count }: { count: number }) {
  const remaining = MIN_OBSERVERS - count;
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,6vw,54px)] font-semibold leading-[1.05]">
        Not enough responses yet
      </h1>
      <p className="mt-5 max-w-[540px] text-[15px] text-muted">
        The comparison report unlocks once at least {MIN_OBSERVERS} people have
        responded — enough that the &ldquo;others&rdquo; view is meaningful and
        no single Observer can be identified.
      </p>

      <div className="mt-8 flex items-center gap-4">
        <div
          className="h-2.5 w-full max-w-[280px] overflow-hidden rounded-full bg-hair/50"
          role="img"
          aria-label={`${count} of ${MIN_OBSERVERS} responses received`}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{ width: `${(count / MIN_OBSERVERS) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-[14px] text-ink">
          {count} of {MIN_OBSERVERS}
        </span>
      </div>

      <p className="mt-6 text-[15px] text-ink">
        {remaining === 1
          ? "Just one more response to go."
          : `${remaining} more responses to go.`}
      </p>

      <div className="mt-10 border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Get your shareable observer link
        </Link>
      </div>
    </div>
  );
}
