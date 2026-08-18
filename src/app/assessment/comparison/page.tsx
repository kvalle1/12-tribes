import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import {
  MIN_OBSERVERS_FOR_REPORT,
  isObserverReportUnlocked,
} from "@/lib/assessment/aggregate-observers";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). Login-gated like
 * the rest of the Subject flow: an unauthenticated visitor routes through
 * sign-in, and a signed-in user who hasn't taken the assessment is sent to start
 * it (there is nothing to compare against yet).
 *
 * The report unlocks only once at least three Observers have responded, so the
 * "others" view is meaningful and no single Observer is identifiable. Below that
 * threshold the page shows a clear locked state with how many more responses are
 * needed and a way back to share the observer link.
 */
export default async function ComparisonPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=${encodeURIComponent("/assessment/comparison")}`,
    );
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponses(session.user.id);
  const unlocked = isObserverReportUnlocked(responses.length);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        {unlocked ? (
          <ComparisonReport
            selfWords={row.words}
            primarySlug={row.primarySlug}
            observerResponses={responses}
          />
        ) : (
          <LockedState responseCount={responses.length} />
        )}
      </div>
    </main>
  );
}

/**
 * The pre-unlock state: shown until at least three Observers have responded, so
 * the aggregate stays meaningful and anonymous. Tells the Subject exactly how
 * many more reads are needed and points them back to the share link.
 */
function LockedState({ responseCount }: { responseCount: number }) {
  const remaining = MIN_OBSERVERS_FOR_REPORT - responseCount;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        360 report
      </p>
      <h1 className="mt-2 font-serif text-[clamp(30px,5vw,44px)] font-semibold leading-[1.05]">
        Not enough reads yet
      </h1>
      <p className="mt-4 max-w-[520px] text-[15px] text-muted">
        Your comparison report unlocks once{" "}
        <strong className="text-ink">{MIN_OBSERVERS_FOR_REPORT}</strong> people
        have described you — that keeps the &ldquo;others&rdquo; view meaningful
        and every observer anonymous.
      </p>
      <p className="mt-6 text-[15px] text-ink">
        {responseCount === 0
          ? "No one has responded yet."
          : `${responseCount} of ${MIN_OBSERVERS_FOR_REPORT} people have responded — ${remaining} more to go.`}
      </p>
      <div className="mt-10 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
        >
          Get your share link
        </Link>
      </div>
    </div>
  );
}
