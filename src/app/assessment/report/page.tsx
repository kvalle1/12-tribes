import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponsesForSubject } from "@/lib/observer/repository";
import { OBSERVER_UNLOCK_THRESHOLD } from "@/lib/assessment/aggregateObservers";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 comparison report page (issue #9). Login-gated like the rest of the
 * assessment flow: an unauthenticated visitor is routed through sign-in, and a
 * signed-in user who hasn't taken the Self Assessment is sent to start it (they
 * need their own profile before there is anything to compare against).
 *
 * The report unlocks only once at least {@link OBSERVER_UNLOCK_THRESHOLD}
 * Observers have responded (ADR-0003) — until then a clear locked state explains
 * how many more reads are needed and keeps individual Observers anonymous.
 */
export default async function ComparisonReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const observerResponses = await getObserverResponsesForSubject(
    session.user.id,
  );
  const unlocked = observerResponses.length >= OBSERVER_UNLOCK_THRESHOLD;

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
            selfWords={row.words}
            observerResponses={observerResponses}
          />
        ) : (
          <LockedReport count={observerResponses.length} shareToken={row.shareToken} />
        )}
      </div>
    </main>
  );
}

/**
 * The pre-unlock state: the report is sealed until at least
 * {@link OBSERVER_UNLOCK_THRESHOLD} Observers respond, so no single Observer can
 * be singled out and the "others" view is meaningful.
 */
function LockedReport({
  count,
  shareToken,
}: {
  count: number;
  shareToken: string;
}) {
  const remaining = OBSERVER_UNLOCK_THRESHOLD - count;
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 report
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,54px)] font-semibold leading-[1.03]">
        Not unlocked yet
      </h1>
      <p className="mt-5 max-w-[560px] text-[15px] text-muted">
        Your comparison report opens once at least{" "}
        <span className="text-ink">{OBSERVER_UNLOCK_THRESHOLD}</span> people have
        described you. This keeps the &ldquo;others&rdquo; view meaningful and
        every responder anonymous.
      </p>

      <div className="mt-8 rounded-[2px] border border-hair p-6">
        <div className="text-[12px] uppercase tracking-[0.16em] text-faint">
          Responses so far
        </div>
        <div className="mt-2 font-serif text-[32px] leading-none">
          {count}{" "}
          <span className="text-[20px] text-muted">
            / {OBSERVER_UNLOCK_THRESHOLD}
          </span>
        </div>
        <p className="mt-3 text-[14px] text-muted">
          {remaining === 1
            ? "Just one more response and your report unlocks."
            : `${remaining} more responses and your report unlocks.`}
        </p>
      </div>

      <p className="mt-8 max-w-[560px] text-[15px] text-muted">
        Keep sharing your observer link with 3–5 people who know you well:
      </p>
      <p className="mt-2 break-all rounded-[2px] border border-hair bg-white/40 px-4 py-3 font-mono text-[13px] text-ink">
        /a/{shareToken}
      </p>

      <div className="mt-12 border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Back to your result
        </Link>
      </div>
    </div>
  );
}
