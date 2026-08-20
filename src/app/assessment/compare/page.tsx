import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponsesForSubject } from "@/lib/observer/repository";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The Subject's 360 comparison report (issue #9, ADR-0003): their own profile
 * beside the equal-weight aggregate of their Observers, with anonymous
 * per-observer drill-down. Login-gated like the rest of the assessment — an
 * unauthenticated visitor is routed through sign-in, and a signed-in user who
 * hasn't taken the assessment is sent to start it (there's nothing to compare
 * against yet).
 *
 * Loading the Observer responses server-side keeps the aggregation and the
 * word→tribe mapping off the client (ADR-0009); the report itself renders the
 * locked state when fewer than three Observers have answered.
 */
export default async function ComparisonPage() {
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
          self={{
            words: row.words,
            primarySlug: row.primarySlug,
            secondarySlug: row.secondarySlug,
          }}
          observerResponses={observerResponses}
        />
      </div>
    </main>
  );
}
