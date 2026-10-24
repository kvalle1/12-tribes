import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The Subject's 360 comparison report (issue #9, ADR-0003) — self vs. the
 * equal-weight aggregate of their anonymous Observers. Login-gated like the rest
 * of the Self flow: an unauthenticated visitor is routed through sign-in, and a
 * signed-in user who hasn't taken the assessment is sent to start it (there is
 * no result, and so no observer link, to compare against).
 *
 * The report itself owns the "locked until ≥3 Observers" gate, so this page
 * simply loads the Subject's saved words and every anonymous Observer response
 * and hands them to {@link ComparisonReport}.
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

  const observerWordLists = await getObserverResponses(session.user.id);

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
          observerWordLists={observerWordLists}
        />
      </div>
    </main>
  );
}
