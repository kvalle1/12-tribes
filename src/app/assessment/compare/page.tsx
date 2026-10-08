import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverComparison } from "@/lib/observer/repository";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). Login-gated like
 * the rest of the assessment: an unauthenticated visitor routes through sign-in,
 * and a signed-in user who hasn't taken the assessment is sent to start it (there
 * is no "self" profile to compare against otherwise).
 *
 * The report itself — locked state below three responses, the full self-vs-others
 * comparison and anonymous per-observer drill-down at or above three — is rendered
 * by {@link ComparisonReport} from the Subject's saved words and the equal-weight
 * observer aggregate.
 */
export default async function ComparisonPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/compare")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const aggregate = await getObserverComparison(session.user.id);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <ComparisonReport selfWords={row.words} aggregate={aggregate} />
      </div>
    </main>
  );
}
