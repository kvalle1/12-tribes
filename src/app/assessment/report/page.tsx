import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getComparisonReport } from "@/lib/observer/report";
import { ComparisonReportView } from "@/components/comparison-report";

/**
 * The Subject's 360 self-vs-others comparison report (issue #9). Login-gated:
 * an unauthenticated visitor is routed through sign-in, and a signed-in user who
 * has not taken the assessment is sent to start it (there is nothing to compare
 * against without a saved self result).
 *
 * The report itself unlocks only once at least three Observers have responded;
 * `ComparisonReportView` renders the locked progress state until then (ADR-0003).
 */
export default async function ComparisonReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const report = await getComparisonReport(session.user.id);
  if (!report) redirect("/assessment");

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        <ComparisonReportView report={report} />
      </div>
    </main>
  );
}
