import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponsesForSubject } from "@/lib/observer/repository";
import { observerShareUrl } from "@/lib/observer/share-link";
import { isReportUnlocked, MIN_OBSERVERS_TO_UNLOCK } from "@/lib/observer/compare";
import { ComparisonReport } from "@/components/comparison-report";
import { ObserverShareLink } from "@/components/observer-share-link";

/**
 * The Subject's 360 comparison report (issue #9, ADR-0003) — how they see
 * themselves against how their observers see them. Login-gated; a Subject who
 * hasn't taken the assessment is sent to start it (there's nothing to compare
 * against yet).
 *
 * The report unlocks only once at least {@link MIN_OBSERVERS_TO_UNLOCK}
 * observers have responded: that keeps the equal-weight average meaningful and
 * keeps any single observer anonymous within it. Below that floor the page shows
 * a locked state with progress and the share link, so the Subject can gather the
 * responses they still need.
 */
export default async function AssessmentReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponsesForSubject(session.user.id);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        {isReportUnlocked(responses.length) ? (
          <ComparisonReport
            selfWords={row.words}
            observerResponses={responses}
          />
        ) : (
          <LockedReport
            observerCount={responses.length}
            shareUrl={await observerShareUrl(row.shareToken)}
          />
        )}
      </div>
    </main>
  );
}

/**
 * Shown before the ≥3-observer floor is reached: explains why the report is
 * still locked, how many responses are in, and offers the share link again so
 * the Subject can gather the rest.
 */
function LockedReport({
  observerCount,
  shareUrl,
}: {
  observerCount: number;
  shareUrl: string;
}) {
  const remaining = MIN_OBSERVERS_TO_UNLOCK - observerCount;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        360 report · locked
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,54px)] font-semibold leading-[1.04]">
        A few more voices
      </h1>
      <p className="mt-4 max-w-[540px] text-[15px] text-muted">
        Your comparison unlocks once at least {MIN_OBSERVERS_TO_UNLOCK} people
        have responded — enough that the combined read is meaningful and no
        single observer can be picked out of it.
      </p>

      <div className="mt-8 rounded-[2px] border border-hair p-5">
        <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
          Responses so far
        </div>
        <div className="mt-2 font-serif text-[28px]">
          <span className="text-gold">{observerCount}</span>{" "}
          <span className="text-faint">/ {MIN_OBSERVERS_TO_UNLOCK}</span>
        </div>
        <p className="mt-2 text-[14px] text-muted">
          {observerCount === 0
            ? "No one has responded yet."
            : `${remaining} more ${remaining === 1 ? "response" : "responses"} to go.`}
        </p>
      </div>

      <section className="mt-10 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Share your link
        </p>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          Send this to 3–5 people who know you well. Each one anonymously picks
          the words that describe you.
        </p>
        <ObserverShareLink url={shareUrl} />
      </section>
    </div>
  );
}
