import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import {
  countObserverResponses,
  getObserverResponses,
} from "@/lib/observer/repository";
import { isReportUnlocked } from "@/lib/observer/aggregate";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The Subject's 360 comparison report (issue #9, ADR-0003): their own profile
 * against the equal-weight aggregate of how their Observers see them, unlocking
 * once at least three Observers have responded.
 *
 * Login-gated like the rest of the Self flow — an unauthenticated visitor is
 * routed through sign-in, and a signed-in user who hasn't taken the assessment
 * is sent to start it (there's no Subject profile to compare against yet). The
 * report renders from the Subject's saved words and their Observers' anonymous
 * responses; all scoring runs server-side (ADR-0009).
 */
export default async function AssessmentReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  // The result row and the observer count are independent — fetch them together.
  const [row, observerCount] = await Promise.all([
    getCurrentResult(session.user.id),
    countObserverResponses(session.user.id),
  ]);
  if (!row) redirect("/assessment");

  // Only load every observer's full word list once the report is actually
  // unlocked; in the common locked state (0–2 responses) the count alone drives
  // the view, so there's nothing to fetch.
  const observerResponses = isReportUnlocked(observerCount)
    ? await getObserverResponses(session.user.id)
    : [];

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Back to your result
        </Link>

        <ComparisonReport
          selfWords={row.words}
          observerCount={observerCount}
          observerResponses={observerResponses}
        />
      </div>
    </main>
  );
}
