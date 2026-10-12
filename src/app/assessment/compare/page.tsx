import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { observerLinkFor } from "@/lib/observer/link";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  MIN_OBSERVERS_FOR_REPORT,
} from "@/lib/assessment/aggregateObservers";
import { ComparisonView } from "@/components/comparison-view";
import { ObserverShareLink } from "@/components/observer-share-link";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). Login-gated and
 * scoped to the signed-in Subject's own result and observers — a Subject only
 * ever sees their own comparison.
 *
 * The report unlocks only once at least `MIN_OBSERVERS_FOR_REPORT` observers
 * have responded: below that the "others" view is neither meaningful nor
 * anonymous enough, so the page renders a locked state that shows progress and
 * re-offers the share link to invite more. All scoring and aggregation run
 * server-side here (the word→tribe mapping never reaches the client, ADR-0009);
 * `ComparisonView` receives only the computed score tables.
 */
export default async function ComparisonReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=${encodeURIComponent("/assessment/compare")}`,
    );
  }

  const row = await getCurrentResult(session.user.id);
  // No result of your own means nothing to compare against — go take it first.
  if (!row) redirect("/assessment");

  const responses = await getObserverResponses(session.user.id);
  const others = aggregateObservers(responses);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        {others.observerCount >= MIN_OBSERVERS_FOR_REPORT ? (
          <ComparisonView selfScores={score(row.words)} others={others} />
        ) : (
          <LockedReport
            observerCount={others.observerCount}
            shareUrl={await observerLinkFor(row.shareToken)}
          />
        )}
      </div>
    </main>
  );
}

/**
 * The pre-unlock state: shown until at least `MIN_OBSERVERS_FOR_REPORT`
 * observers have responded. It never reveals any aggregated "others" scores (a
 * one- or two-observer average would not be anonymous), only the progress count
 * and the share link to gather more.
 */
function LockedReport({
  observerCount,
  shareUrl,
}: {
  observerCount: number;
  shareUrl: string;
}) {
  const remaining = MIN_OBSERVERS_FOR_REPORT - observerCount;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        360 comparison · locked
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        A few more voices to go
      </h1>
      <p className="mt-5 max-w-[560px] text-[15px] text-muted">
        Your comparison report unlocks once at least {MIN_OBSERVERS_FOR_REPORT}{" "}
        people have answered — enough that the &ldquo;others&rdquo; view stays
        meaningful and every observer stays anonymous.
      </p>

      <div className="mt-8 rounded-[2px] border border-hair p-6">
        <div className="text-[12px] uppercase tracking-[0.16em] text-faint">
          Responses so far
        </div>
        <div className="mt-2 font-serif text-[40px] font-semibold leading-none">
          {observerCount}
          <span className="text-[22px] text-muted">
            {" "}
            / {MIN_OBSERVERS_FOR_REPORT}
          </span>
        </div>
        <p className="mt-3 text-[14px] text-muted">
          {observerCount === 0
            ? "No one has responded yet."
            : `${remaining} more ${remaining === 1 ? "response" : "responses"} to unlock your report.`}
        </p>
      </div>

      <section className="mt-10 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Invite more observers
        </p>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          Send this link to people who know you well. Each one anonymously picks
          the words that describe you.
        </p>
        <ObserverShareLink url={shareUrl} />
      </section>
    </div>
  );
}
