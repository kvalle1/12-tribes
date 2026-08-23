import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import {
  countObserverResponses,
  getObserverResponses,
} from "@/lib/observer/repository";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  MIN_OBSERVERS_FOR_REPORT,
} from "@/lib/observer/aggregate";
import { ComparisonView } from "@/components/comparison-view";

/**
 * The 360 comparison report (issue #9, ADR-0003). Login-gated and private to the
 * Subject: it shows the Subject's own profile beside the equal-weight aggregated
 * "others" profile, with anonymous per-observer drill-down.
 *
 * The report unlocks only once at least {@link MIN_OBSERVERS_FOR_REPORT}
 * Observers have responded — below that the "others" average isn't meaningful and
 * individual anonymity is thin, so a clear locked state is shown instead.
 */
export default async function ComparisonReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  // The result and the observer count are independent — fetch them together.
  // The count answers the unlock gate without transferring every observer's
  // words; the full responses are loaded only once the report actually unlocks.
  const [row, observerCount] = await Promise.all([
    getCurrentResult(session.user.id),
    countObserverResponses(session.user.id),
  ]);
  if (!row) redirect("/assessment");

  const unlocked = observerCount >= MIN_OBSERVERS_FOR_REPORT;
  const responses = unlocked
    ? await getObserverResponses(session.user.id)
    : [];

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        {unlocked ? (
          <ComparisonView
            self={score(row.words)}
            aggregate={aggregateObservers(responses)}
          />
        ) : (
          <LockedReport responseCount={observerCount} />
        )}
      </div>
    </main>
  );
}

/**
 * Shown until at least {@link MIN_OBSERVERS_FOR_REPORT} Observers respond. States
 * plainly how many more are needed and points back to the result page, where the
 * shareable observer link lives.
 */
function LockedReport({ responseCount }: { responseCount: number }) {
  const remaining = MIN_OBSERVERS_FOR_REPORT - responseCount;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        360 comparison · locked
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,54px)] font-semibold leading-[1.04]">
        A few more reads to go
      </h1>
      <p className="mt-5 max-w-[540px] text-[16px] leading-relaxed text-muted">
        Your comparison report opens once at least {MIN_OBSERVERS_FOR_REPORT}{" "}
        people have described you. That keeps the &ldquo;others&rdquo; view
        meaningful and every observer anonymous.
      </p>

      <div className="mt-10 rounded-[2px] border border-hair p-6">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-[40px] font-semibold text-gold">
            {responseCount}
          </span>
          <span className="text-[15px] text-muted">
            of {MIN_OBSERVERS_FOR_REPORT} responses so far
          </span>
        </div>
        <div className="mt-4 flex gap-2" aria-hidden>
          {Array.from({ length: MIN_OBSERVERS_FOR_REPORT }).map((_, i) => (
            <span
              key={i}
              className={`h-2 flex-1 rounded-full ${
                i < responseCount ? "bg-gold" : "bg-hair/60"
              }`}
            />
          ))}
        </div>
        <p className="mt-5 text-[15px] text-ink">
          {remaining} more{" "}
          {remaining === 1 ? "observer" : "observers"} needed to unlock.
        </p>
      </div>

      <Link
        href="/assessment/result"
        className="mt-10 inline-block rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
      >
        Get your share link
      </Link>
    </div>
  );
}
