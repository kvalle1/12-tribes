import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). Login-gated
 * like the rest of the Self flow: an unauthenticated visitor is routed through
 * sign-in, and a signed-in user who hasn't taken the assessment is sent to
 * start it (there's nothing of their own to compare against yet).
 *
 * Observer scoring and the ≥3 unlock gate both live behind `ComparisonReport`
 * (a server component), so the word→tribe mapping never reaches the client
 * (ADR-0009). This page only resolves the Subject and loads their saved
 * selection plus the anonymous Observer responses.
 */
export default async function ComparePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/compare")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const observerResponses = await getObserverResponses(session.user.id);

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
          observerResponses={observerResponses}
        />
      </div>
    </main>
  );
}
