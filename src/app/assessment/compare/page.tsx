import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponsesForSubject } from "@/lib/observer/repository";
import {
  MIN_OBSERVERS_TO_UNLOCK,
  isComparisonUnlocked,
} from "@/lib/observer/aggregate";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The self-vs-others 360 comparison report (issue #9, ADR-0003). Login-gated,
 * like the rest of the assessment: an unauthenticated visitor is routed through
 * sign-in, and a signed-in user who hasn't taken the assessment is sent to start
 * it (there is no "self" to compare against otherwise).
 *
 * The report unlocks only once at least `MIN_OBSERVERS_TO_UNLOCK` observers have
 * responded. Below that threshold the page shows a clear locked state with how
 * many more responses are needed, so the average stays meaningful and no single
 * observer can be singled out. The unlock decision lives here; `ComparisonReport`
 * assumes it is being shown an unlocked report.
 */
export default async function ComparePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/compare")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponsesForSubject(session.user.id);
  const unlocked = isComparisonUnlocked(responses.length);

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
            selfWords={row.words}
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
 * The pre-unlock state: shown until at least `MIN_OBSERVERS_TO_UNLOCK` observers
 * respond. States plainly how many more are needed and keeps the Subject pointed
 * back at the share link, without hinting at who (if anyone) has already replied.
 */
function LockedState({ responseCount }: { responseCount: number }) {
  const remaining = Math.max(MIN_OBSERVERS_TO_UNLOCK - responseCount, 0);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.05]">
        Not unlocked yet
      </h1>
      <p className="mt-5 max-w-[540px] text-[16px] leading-relaxed text-muted">
        Your comparison report opens once{" "}
        <span className="text-ink">{MIN_OBSERVERS_TO_UNLOCK} people</span> have
        shared how they see you. That threshold keeps the &ldquo;others&rdquo;
        read meaningful and every observer anonymous.
      </p>

      <div className="mt-10 rounded-[2px] border border-hair p-6">
        <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
          Progress
        </p>
        <p className="mt-3 font-serif text-[28px] text-ink">
          {responseCount} of {MIN_OBSERVERS_TO_UNLOCK}
        </p>
        <p className="mt-2 text-[15px] text-muted">
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
          Get your share link
        </Link>
      </div>
    </div>
  );
}
