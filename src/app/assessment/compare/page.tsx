import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponsesForSubject } from "@/lib/observer/repository";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 comparison report page (issue #9, ADR-0003): the Subject's own
 * profile against the equal-weight aggregate of their anonymous Observers.
 *
 * Login-gated like the result page — an unauthenticated visitor routes through
 * sign-in, and a signed-in user who hasn't taken the assessment is sent to start
 * it (there is no "self" to compare against otherwise). The observer responses
 * are loaded server-side and handed to `ComparisonReport`, which gates itself to
 * the ≥3 threshold and renders the locked state below that.
 */
export default async function ComparePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=${encodeURIComponent("/assessment/compare")}`,
    );
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const observerResponses = await getObserverResponsesForSubject(
    session.user.id,
  );

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <ComparisonReport
          selfWords={row.words}
          observerResponses={observerResponses}
        />
      </div>
    </main>
  );
}
