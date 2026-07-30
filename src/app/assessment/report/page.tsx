import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import {
  isReportUnlocked,
  MIN_OBSERVERS_FOR_REPORT,
} from "@/lib/observer/aggregate";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The Subject's 360 comparison report (issue #9, ADR-0003). Login-gated and
 * personal: it shows how the Subject's anonymous Observers scored them beside
 * their own result. Unlocks only once at least three Observers have responded —
 * before then the Subject sees a clear locked state with the running count,
 * which both keeps the average meaningful and preserves observer anonymity.
 *
 * All scoring and aggregation run in the `server-only` cores this server
 * component pulls in; nothing about the word→tribe mapping or the raw observer
 * rows reaches the client (ADR-0009).
 */
export default async function ReportPage() {
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
            selfWords={row.words}
            observerResponses={responses}
          />
        ) : (
          <LockedReport responseCount={responses.length} />
        )}
      </div>
    </main>
  );
}

/**
 * The pre-unlock state: enough context to know the report is coming and how
 * close it is, without revealing anything about individual Observers.
 */
function LockedReport({ responseCount }: { responseCount: number }) {
  const remaining = MIN_OBSERVERS_FOR_REPORT - responseCount;
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 report
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5vw,48px)] font-semibold leading-[1.05]">
        Not unlocked yet
      </h1>
      <p className="mt-4 max-w-[520px] text-[16px] text-muted">
        Your comparison report opens once at least{" "}
        {MIN_OBSERVERS_FOR_REPORT} people have responded. That keeps the
        &ldquo;how others see you&rdquo; read meaningful and each observer
        anonymous.
      </p>

      <div className="mt-10 rounded-[2px] border border-hair p-6">
        <div className="text-[12px] uppercase tracking-[0.16em] text-faint">
          Responses so far
        </div>
        <div className="mt-2 font-serif text-[32px] font-semibold">
          {responseCount}{" "}
          <span className="text-[20px] font-normal text-muted">
            of {MIN_OBSERVERS_FOR_REPORT}
          </span>
        </div>
        <p className="mt-3 text-[14px] text-muted">
          {remaining === 1
            ? "Just one more response and your report unlocks."
            : `${remaining} more responses and your report unlocks.`}
        </p>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-[22px]">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Share your observer link
        </Link>
      </div>
    </div>
  );
}
