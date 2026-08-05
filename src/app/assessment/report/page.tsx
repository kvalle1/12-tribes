import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { ObserverComparison } from "@/components/observer-comparison";

/**
 * The 360 comparison report (issue #9): the Subject's own profile beside the
 * equal-weight "how others see you" profile, unlocking once at least three
 * Observers have responded (ADR-0003).
 *
 * Login-gated, like the rest of the assessment flow (ADR-0004): an
 * unauthenticated visitor is routed through sign-in, and a signed-in user who
 * hasn't taken the assessment is sent to start it (there's nothing to compare
 * against without their own result). The heavy lifting — scoring, aggregation,
 * the locked/unlocked decision — lives in the server-only `ObserverComparison`.
 */
export default async function ObserverReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const result = await getCurrentResult(session.user.id);
  if (!result) redirect("/assessment");

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

        <ObserverComparison
          selfWords={result.words}
          observerResponses={observerResponses}
        />
      </div>
    </main>
  );
}
