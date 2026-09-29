import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import {
  countObserverResponses,
  getObserverWordLists,
} from "@/lib/observer/repository";
import { MIN_OBSERVERS, hasEnoughObservers } from "@/lib/observer/constants";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The Subject's 360 comparison report (issue #9, ADR-0003): their own profile
 * beside the equal-weight "others" profile aggregated from their Observers.
 *
 * Login-gated and Subject-only — the report is built from the signed-in user's
 * own result and the responses tied to it; there is no way to view anyone else's.
 * The report **unlocks only once at least `MIN_OBSERVERS` Observers have
 * responded** (ADR-0003); before then this renders a clear locked state showing
 * how many more reads are needed, so the average stays meaningful and no single
 * anonymous Observer can be singled out.
 */
export default async function ComparisonReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const observerCount = await countObserverResponses(session.user.id);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        {hasEnoughObservers(observerCount) ? (
          <ComparisonReport
            selfWords={row.words}
            primarySlug={row.primarySlug}
            observerWordLists={await getObserverWordLists(session.user.id)}
          />
        ) : (
          <LockedReport count={observerCount} />
        )}
      </div>
    </main>
  );
}

/**
 * The pre-unlock state. Shows progress toward the {@link MIN_OBSERVERS} floor so
 * the Subject understands why the comparison isn't available yet and what closes
 * the gap.
 */
function LockedReport({ count }: { count: number }) {
  const remaining = Math.max(MIN_OBSERVERS - count, 0);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Self vs. others
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        Your comparison is almost ready
      </h1>
      <p className="mt-4 max-w-[540px] text-[16px] leading-relaxed text-muted">
        The 360 report unlocks once at least {MIN_OBSERVERS} people have shared
        how they see you. That floor keeps the &ldquo;others&rdquo; read
        meaningful and every Observer anonymous.
      </p>

      <div className="mt-10 rounded-[2px] border border-hair p-6">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] uppercase tracking-[0.16em] text-faint">
            Responses so far
          </span>
          <span className="font-serif text-[22px] tabular-nums">
            {count} / {MIN_OBSERVERS}
          </span>
        </div>
        <div
          className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-hair/50"
          role="img"
          aria-label={`${count} of ${MIN_OBSERVERS} observer responses received`}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{ width: `${Math.min((count / MIN_OBSERVERS) * 100, 100)}%` }}
          />
        </div>
        <p className="mt-4 text-[15px] text-muted">
          {remaining === 1
            ? "Just one more response and your comparison unlocks."
            : `${remaining} more responses and your comparison unlocks.`}
        </p>
      </div>

      <div className="mt-10">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Share your observer link
        </Link>
      </div>
    </div>
  );
}
