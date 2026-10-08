import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponsesForSubject } from "@/lib/observer/repository";
import { MIN_OBSERVERS_FOR_REPORT } from "@/lib/observer/aggregate";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The Subject's 360 comparison report (issue #9, ADR-0003). Login-gated: an
 * unauthenticated visitor is routed through sign-in, and a signed-in user who
 * hasn't taken the assessment is sent to start it (there's nothing to compare
 * against yet).
 *
 * The report unlocks only once at least {@link MIN_OBSERVERS_FOR_REPORT}
 * observers have responded — below that we show a clear locked state with the
 * running count, which both keeps the equal-weight average meaningful and
 * protects each observer's anonymity. Once unlocked, the self-vs-others
 * comparison is computed entirely server-side (ADR-0009) by `ComparisonReport`.
 */
export default async function ReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/report")}`);
  }

  const result = await getCurrentResult(session.user.id);
  if (!result) redirect("/assessment");

  const responses = await getObserverResponsesForSubject(session.user.id);
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

        {unlocked ? (
          <ComparisonReport
            selfWords={result.words}
            observerResponses={responses}
          />
        ) : (
          <LockedReport count={responses.length} />
        )}
      </div>
    </main>
  );
}

/**
 * The pre-unlock state: the report is locked until at least three observers have
 * responded. Shows how many have so far and how many remain, and keeps the
 * observer link reachable so the Subject can nudge the rest.
 */
function LockedReport({ count }: { count: number }) {
  const remaining = Math.max(MIN_OBSERVERS_FOR_REPORT - count, 0);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        A few more responses
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Your comparison report unlocks once at least{" "}
        {MIN_OBSERVERS_FOR_REPORT} people have responded. That keeps the
        &ldquo;others&rdquo; read meaningful and every observer anonymous.
      </p>

      <div className="mt-10 rounded-[2px] border border-hair p-6">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] uppercase tracking-[0.16em] text-faint">
            Responses so far
          </span>
          <span className="font-serif text-[22px]">
            {count}
            <span className="text-faint"> / {MIN_OBSERVERS_FOR_REPORT}</span>
          </span>
        </div>
        <div
          className="mt-4 flex gap-2"
          role="img"
          aria-label={`${count} of ${MIN_OBSERVERS_FOR_REPORT} observer responses received`}
        >
          {Array.from({ length: MIN_OBSERVERS_FOR_REPORT }).map((_, i) => (
            <div
              key={i}
              className={`h-2.5 flex-1 rounded-full ${
                i < count ? "bg-gold" : "bg-hair/60"
              }`}
            />
          ))}
        </div>
        <p className="mt-5 text-[14px] text-muted">
          {remaining === 0
            ? "Your report is ready — refresh to see it."
            : `${remaining} more ${
                remaining === 1 ? "response" : "responses"
              } to go.`}
        </p>
      </div>

      <div className="mt-10 border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Get your observer link
        </Link>
      </div>
    </div>
  );
}
