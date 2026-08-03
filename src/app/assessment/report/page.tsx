import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  MIN_OBSERVERS_FOR_REPORT,
} from "@/lib/assessment/aggregate-observers";
import { rankScores } from "@/lib/assessment/ranking";
import {
  ComparisonReport,
  type ComparisonRow,
} from "@/components/comparison-report";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003), closing the
 * loop the observer flow (#8) opened.
 *
 * Login-gated like the rest of the assessment: an unauthenticated visitor is
 * routed through sign-in, and a signed-in user who hasn't taken the assessment
 * is sent to take it (there's no self profile to compare against otherwise).
 *
 * The report unlocks only once at least `MIN_OBSERVERS_FOR_REPORT` Observers
 * have responded — before then the aggregate would be too thin to be meaningful
 * and individual Observers too easy to single out — so below the threshold we
 * render a clear locked state instead. All scoring happens here on the server;
 * the presentational `ComparisonReport` receives only plain numbers.
 */
export default async function ComparisonReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponses(session.user.id);
  const observerCount = responses.length;

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        {observerCount < MIN_OBSERVERS_FOR_REPORT ? (
          <LockedState observerCount={observerCount} />
        ) : (
          <UnlockedReport
            words={row.words}
            responses={responses.map((r) => r.words)}
          />
        )}
      </div>
    </main>
  );
}

/**
 * Compute the comparison and hand plain numbers to the presentational report.
 * Both readings are placed on a shared scale (the max score across the Subject
 * and the aggregated Observers) so their bars are directly comparable, and the
 * rows are ordered by how prominent a tribe is across the two readings.
 */
function UnlockedReport({
  words,
  responses,
}: {
  words: string[];
  responses: string[][];
}) {
  const selfScores = score(words);
  const othersScores = aggregateObservers(responses);

  const sharedMax = Math.max(
    ...selfScores.map((s) => s.score),
    ...othersScores.map((s) => s.score),
    0,
  );
  const rel = (value: number) => (sharedMax > 0 ? value / sharedMax : 0);

  const rows: ComparisonRow[] = selfScores
    .map((self, i) => {
      const others = othersScores[i];
      return {
        slug: self.slug,
        name: self.name,
        self: self.score,
        others: others.score,
        selfRel: rel(self.score),
        othersRel: rel(others.score),
      };
    })
    // Most prominent tribes first (by the two readings combined); the source
    // array is in canonical order, so ties stay deterministic.
    .sort((a, b) => (b.self + b.others) / 2 - (a.self + a.others) / 2);

  const observers = responses.map((observerWords, i) => ({
    label: `Observer ${i + 1}`,
    bars: rankScores(score(observerWords)),
  }));

  return (
    <ComparisonReport
      rows={rows}
      observerCount={responses.length}
      observers={observers}
    />
  );
}

/** Shown until at least `MIN_OBSERVERS_FOR_REPORT` Observers have responded. */
function LockedState({ observerCount }: { observerCount: number }) {
  const remaining = MIN_OBSERVERS_FOR_REPORT - observerCount;
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        The 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        Your comparison is still locked
      </h1>
      <p className="mt-4 max-w-[520px] text-[15px] text-muted">
        The self-vs-others report opens once at least{" "}
        {MIN_OBSERVERS_FOR_REPORT} people have described you — enough that the
        &ldquo;others&rdquo; view is meaningful and every Observer stays
        anonymous.
      </p>

      <div className="mt-8 rounded-[2px] border border-hair bg-white/50 px-5 py-4">
        <p className="text-[14px] text-ink">
          {observerCount === 0
            ? "No one has responded yet."
            : `${observerCount} of ${MIN_OBSERVERS_FOR_REPORT} Observers so far.`}{" "}
          <span className="text-muted">
            {remaining} more {remaining === 1 ? "response" : "responses"} to
            unlock.
          </span>
        </p>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-hair/50"
          role="img"
          aria-label={`${observerCount} of ${MIN_OBSERVERS_FOR_REPORT} Observers responded`}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{
              width: `${(observerCount / MIN_OBSERVERS_FOR_REPORT) * 100}%`,
            }}
          />
        </div>
      </div>

      <p className="mt-8 max-w-[520px] text-[15px] text-muted">
        Keep sharing your observer link to gather more reads:
      </p>
      <p className="mt-2">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Copy your observer link
        </Link>
      </p>
    </div>
  );
}
