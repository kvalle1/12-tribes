import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { accentHex, tribes } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  MIN_OBSERVERS_FOR_REPORT,
} from "@/lib/assessment/aggregateObservers";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { observerShareUrl } from "@/lib/observer/share-url";
import { ObserverShareLink } from "@/components/observer-share-link";
import { ReportComparison } from "@/components/report-comparison";

/**
 * The 360 comparison report (issue #9, ADR-0003). Login-gated and Subject-only:
 * it shows the signed-in user their own profile beside the equal-weight "others"
 * profile aggregated from anonymous Observer responses.
 *
 * The report unlocks only once at least three Observers have responded — until
 * then it renders a clear locked state with progress and the share link, which
 * keeps the average meaningful and each Observer anonymous. All scoring and
 * aggregation run here on the server; only finished numbers cross to the client
 * comparison view (ADR-0009).
 */
export default async function ReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponses(session.user.id);
  const unlocked = responses.length >= MIN_OBSERVERS_FOR_REPORT;

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Your 360 report
        </p>
        <h1 className="mt-2 font-serif text-[clamp(34px,5.5vw,52px)] font-semibold leading-[1.05]">
          How others see you
        </h1>

        {unlocked ? (
          <UnlockedReport words={row.words} responses={responses} />
        ) : (
          <LockedReport
            count={responses.length}
            shareUrl={await observerShareUrl(row.shareToken)}
          />
        )}
      </div>
    </main>
  );
}

function UnlockedReport({
  words,
  responses,
}: {
  words: string[];
  responses: string[][];
}) {
  const self = score(words);
  const { average, observers } = aggregateObservers(responses);
  const accentBySlug = Object.fromEntries(
    tribes.map((t) => [t.slug, accentHex(t.color)]),
  );

  return (
    <div className="mt-8">
      <p className="max-w-[540px] text-[16px] text-muted">
        Your own read is in dark; the {observers.length} people who described you
        are in gold — each counted equally, no matter how many words they picked.
        The gap is where the most useful insight lives.
      </p>
      <div className="mt-10">
        <ReportComparison
          self={self}
          others={average}
          observers={observers}
          accentBySlug={accentBySlug}
        />
      </div>
    </div>
  );
}

function LockedReport({
  count,
  shareUrl,
}: {
  count: number;
  shareUrl: string;
}) {
  const remaining = MIN_OBSERVERS_FOR_REPORT - count;

  return (
    <div className="mt-8">
      <div className="rounded-[2px] border border-hair bg-white/40 p-6">
        <p className="text-[12px] uppercase tracking-[0.16em] text-faint">
          Locked
        </p>
        <p className="mt-3 font-serif text-[22px] leading-snug">
          {count === 0
            ? "No one has responded yet."
            : `${count} of ${MIN_OBSERVERS_FOR_REPORT} people have responded.`}
        </p>
        <p className="mt-3 max-w-[520px] text-[15px] text-muted">
          Your report unlocks once{" "}
          {MIN_OBSERVERS_FOR_REPORT} people respond — enough for a meaningful
          average while keeping every responder anonymous.{" "}
          {remaining === 1
            ? "Just one more to go."
            : `${remaining} more to go.`}
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
