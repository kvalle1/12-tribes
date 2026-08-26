import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverSelections } from "@/lib/observer/repository";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The Subject's 360 comparison report (issue #9, ADR-0003): their own profile
 * beside the equal-weight aggregated "others" profile, unlocked once at least
 * three observers have responded.
 *
 * Login-gated like the result page: an unauthenticated visitor is routed through
 * sign-in, and a signed-in user who hasn't taken the assessment yet is sent to
 * start it (there's nothing to compare against without a Self result). The
 * locked-vs-unlocked decision lives in `ComparisonReport`, which reads the
 * observer count; this page just loads the data on the server.
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

  const observerSelections = await getObserverSelections(session.user.id);

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
          words={row.words}
          observerSelections={observerSelections}
        />
      </div>
    </main>
  );
}
