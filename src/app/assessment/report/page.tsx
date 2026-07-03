import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverWordLists } from "@/lib/observer/repository";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * beside the equal-weight aggregate of their anonymous Observers, plus a
 * per-observer drill-down. Login-gated like the rest of the assessment; an
 * unauthenticated visitor is routed through sign-in and a signed-in user who
 * hasn't taken the assessment is sent to start it (there is no Subject to
 * compare against until they have a saved result).
 *
 * The report locks until at least three Observers have responded — that gate,
 * and all scoring of the Subject's and Observers' words, lives inside
 * `ComparisonReport` on the server.
 */
export default async function AssessmentReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const observerWordLists = await getObserverWordLists(session.user.id);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        <ComparisonReport words={row.words} observerWordLists={observerWordLists} />
      </div>
    </main>
  );
}
