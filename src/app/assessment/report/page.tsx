import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The Subject's 360 comparison report (issue #9, ADR-0003): their own profile
 * against the equal-weight aggregate of anonymous Observer responses. Login-gated
 * like the result page — an unauthenticated visitor is routed through sign-in,
 * and a signed-in user who hasn't taken the assessment is sent to start it (there
 * is no self profile to compare against otherwise).
 *
 * The report only unlocks once at least three Observers have responded; the
 * `ComparisonReport` component renders the locked state before then, so this page
 * always renders regardless of how many responses exist.
 */
export default async function ComparisonReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
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
