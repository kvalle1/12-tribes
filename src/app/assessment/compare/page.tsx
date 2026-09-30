import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverWordSets } from "@/lib/observer/repository";
import { observerShareUrl } from "@/lib/observer/share-link";
import { aggregateObservers, isReportUnlocked } from "@/lib/observer/aggregate";
import { ComparisonReport } from "@/components/comparison-report";
import { ObserverShareLink } from "@/components/observer-share-link";

/**
 * The Subject's 360 comparison report (issue #9, ADR-0003): their own profile
 * against the equal-weight average of anonymous observers, unlocking at three
 * responses.
 *
 * Login-gated — a Subject views only their own report. An unauthenticated
 * visitor is routed through sign-in; a signed-in user who hasn't taken the
 * assessment is sent to start it (no result means no observer link and no
 * observers). Scoring and aggregation run entirely server-side (ADR-0009); only
 * finished numbers reach the client via `ComparisonReport`.
 */
export default async function ComparisonReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=${encodeURIComponent("/assessment/compare")}`,
    );
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const observerWordSets = await getObserverWordSets(session.user.id);
  const aggregate = aggregateObservers(observerWordSets);
  const shareUrl = await observerShareUrl(row.shareToken);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        <ComparisonReport words={row.words} aggregate={aggregate} />

        {/* Whether locked or unlocked, more observers sharpen the picture, so the
            share link stays close at hand. */}
        <section className="mt-14 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            {isReportUnlocked(aggregate.count)
              ? "Want a sharper read?"
              : "Invite more observers"}
          </p>
          <p className="mt-2 max-w-[520px] text-[15px] text-muted">
            Send this link to more people who know you well. Each one anonymously
            picks the words that describe you.
          </p>
          <ObserverShareLink url={shareUrl} />
        </section>
      </div>
    </main>
  );
}
