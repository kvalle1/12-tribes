import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverWordLists } from "@/lib/observer/repository";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile
 * beside the equal-weight "others" profile their anonymous Observers produced.
 *
 * Login-gated like the result page — an unauthenticated visitor routes through
 * sign-in, and a signed-in user who hasn't taken the assessment is sent to start
 * it (there is no self profile to compare against yet). The report itself locks
 * until at least three Observers have responded; that gate lives in
 * `ComparisonReport` so the page always renders a clear state.
 *
 * All scoring and aggregation run here on the server (the scoring core is
 * `server-only`); the client only ever receives the rendered comparison.
 */
export default async function ComparisonReportPage() {
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
