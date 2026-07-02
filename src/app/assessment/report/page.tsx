import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { score } from "@/lib/assessment/score";
import { aggregateObservers } from "@/lib/assessment/aggregateObservers";
import {
  MIN_OBSERVERS_FOR_REPORT,
  hasEnoughObservers,
} from "@/lib/assessment/constants";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 comparison report (issue #9, ADR-0003). Login-gated and tied to the
 * signed-in Subject. Scores the Subject's own selection and the anonymous
 * Observer responses entirely on the server, then either renders the locked
 * state (fewer than three Observers) or hands the plain, computed numbers to the
 * `ComparisonReport` client view. The scoring core and word→tribe mapping never
 * reach the client (ADR-0009).
 */
export default async function ComparisonReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponses(session.user.id);
  const { count, average, observers } = aggregateObservers(responses);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        {hasEnoughObservers(count) ? (
          <ComparisonReport
            self={score(row.words)}
            others={average}
            observers={observers}
          />
        ) : (
          <LockedReport count={count} />
        )}
      </div>
    </main>
  );
}

/**
 * The locked state, shown until at least three Observers have responded. It
 * makes the threshold and current progress clear so the Subject knows how many
 * more reads they need — without revealing anything about who has responded.
 */
function LockedReport({ count }: { count: number }) {
  const remaining = MIN_OBSERVERS_FOR_REPORT - count;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 reflection
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,52px)] font-semibold leading-[1.04]">
        Not enough reads yet
      </h1>
      <p className="mt-4 max-w-[520px] text-[16px] text-muted">
        Your comparison unlocks once at least {MIN_OBSERVERS_FOR_REPORT} people
        have shared an anonymous read. That floor keeps the &ldquo;others&rdquo;
        view meaningful and each individual response anonymous.
      </p>

      <div className="mt-8 rounded-[2px] border border-hair bg-white/60 p-6">
        <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
          Responses so far
        </div>
        <div className="mt-2 font-serif text-[40px] leading-none">
          {count}{" "}
          <span className="text-[22px] text-muted">
            / {MIN_OBSERVERS_FOR_REPORT}
          </span>
        </div>
        <div className="mt-4 flex gap-2" aria-hidden>
          {Array.from({ length: MIN_OBSERVERS_FOR_REPORT }).map((_, i) => (
            <span
              key={i}
              className={`h-2.5 flex-1 rounded-full ${
                i < count ? "bg-gold" : "bg-hair/60"
              }`}
            />
          ))}
        </div>
        <p className="mt-5 text-[15px] text-muted">
          {remaining === 1
            ? "Just one more response to go."
            : `${remaining} more responses to go.`}
        </p>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-[22px]">
        <Link
          href="/assessment/result"
          className="rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
        >
          Get your share link
        </Link>
      </div>
    </div>
  );
}
