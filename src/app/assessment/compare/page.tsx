import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 comparison report page (issue #9): the Subject's own profile set beside
 * the equal-weight aggregate of everyone who described them, unlocking at three
 * Observers.
 *
 * Login-gated like the rest of the assessment (ADR-0004): an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it (there is nothing to compare against without a
 * self result). The observer responses are loaded anonymously and handed to the
 * server-rendered `ComparisonReport`, which decides between the locked and
 * unlocked views.
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
