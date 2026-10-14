import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 comparison report page (issue #9, ADR-0003). Login-gated like the
 * result page: an unauthenticated visitor is routed through sign-in, and a
 * signed-in user who hasn't taken the assessment is sent to start it (there's no
 * self profile to compare against yet).
 *
 * All the self-vs-others work — equal-weight aggregation, the ≥3 unlock gate and
 * its locked state — lives in the server-only `ComparisonReport`. This page only
 * authenticates, loads the Subject's own result and their anonymous observer
 * responses, and hands both to it.
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

  const observerResponses = await getObserverResponses(session.user.id);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        <ComparisonReport
          selfWords={row.words}
          observerResponses={observerResponses}
        />
      </div>
    </main>
  );
}
