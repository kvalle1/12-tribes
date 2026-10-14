import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  isReportUnlocked,
  MIN_OBSERVERS_FOR_REPORT,
} from "@/lib/assessment/aggregateObservers";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). Login-gated:
 * the signed-in user views the report for their *own* result, so an
 * unauthenticated visitor is routed through sign-in, and a signed-in user who
 * hasn't taken the assessment is sent to start it (there's nothing to compare
 * against yet).
 *
 * The report unlocks only once at least {@link MIN_OBSERVERS_FOR_REPORT}
 * Observers have responded; below that it shows a clear locked state rather than
 * a thin, de-anonymizing "others" view. All scoring runs here on the server and
 * only plain scored profiles are handed to the view (ADR-0009 trust boundary).
 */
export default async function ComparisonReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponses(session.user.id);
  const unlocked = isReportUnlocked(responses.length);

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
            others={aggregateObservers(responses)}
            perObserver={responses.map((words) => score(words))}
          />
        ) : (
          <LockedState responseCount={responses.length} />
        )}
      </div>
    </main>
  );
}

/**
 * The clear locked state shown before enough Observers have responded. Tells the
 * Subject exactly how many reads are in and how many more unlock the report,
 * without exposing any of the thin early data.
 */
function LockedState({ responseCount }: { responseCount: number }) {
  const remaining = MIN_OBSERVERS_FOR_REPORT - responseCount;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.05]">
        Not enough reads yet
      </h1>
      <p className="mt-4 max-w-[520px] text-[15px] text-muted">
        {responseCount === 0
          ? "No one has described you yet."
          : `${responseCount} of ${MIN_OBSERVERS_FOR_REPORT} people have described you so far.`}{" "}
        The comparison unlocks once at least {MIN_OBSERVERS_FOR_REPORT} have
        responded — enough that the &ldquo;others&rdquo; view is meaningful and no
        single person can be singled out.
      </p>
      <p className="mt-3 text-[15px] text-muted">
        {remaining === 1
          ? "Just one more read to go."
          : `${remaining} more reads to go.`}
      </p>

      <div className="mt-10 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
        >
          Get your share link
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
