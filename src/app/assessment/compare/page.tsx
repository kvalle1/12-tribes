import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import {
  isComparisonUnlocked,
  MIN_OBSERVERS_TO_UNLOCK,
} from "@/lib/assessment/aggregate";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * beside the equal-weight "others" profile. Login-gated like the saved result —
 * an unauthenticated visitor is routed through sign-in, and a signed-in user who
 * hasn't taken the assessment is sent to start it.
 *
 * The report unlocks only once at least {@link MIN_OBSERVERS_TO_UNLOCK} observers
 * have responded; before then the page shows a locked state with how many reads
 * are still needed, which both keeps the average meaningful and preserves each
 * observer's anonymity.
 */
export default async function ComparePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=${encodeURIComponent("/assessment/compare")}`,
    );
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const observerSelections = await getObserverResponses(session.user.id);
  const unlocked = isComparisonUnlocked(observerSelections.length);

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
            observerSelections={observerSelections}
          />
        ) : (
          <LockedState responded={observerSelections.length} shareToken={row.shareToken} />
        )}
      </div>
    </main>
  );
}

/**
 * Shown until at least {@link MIN_OBSERVERS_TO_UNLOCK} observers have responded.
 * Reports progress toward the unlock so the Subject knows how many more reads to
 * gather, and points them back to their shareable link.
 */
function LockedState({
  responded,
  shareToken,
}: {
  responded: number;
  shareToken: string;
}) {
  const remaining = Math.max(MIN_OBSERVERS_TO_UNLOCK - responded, 0);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        A 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        Not enough reads yet
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Your comparison unlocks once{" "}
        <strong className="font-medium text-ink">
          {MIN_OBSERVERS_TO_UNLOCK} people
        </strong>{" "}
        have described you. Keeping it to three or more makes the average
        meaningful and keeps every single read anonymous.
      </p>

      <div className="mt-10 rounded-[3px] border border-hair bg-white/60 p-6">
        <div className="flex items-baseline justify-between">
          <p className="text-[12px] uppercase tracking-[0.18em] text-faint">
            Reads so far
          </p>
          <p className="font-serif text-[15px] text-ink">
            {responded} of {MIN_OBSERVERS_TO_UNLOCK}
          </p>
        </div>
        <ol className="mt-4 flex gap-2" aria-hidden>
          {Array.from({ length: MIN_OBSERVERS_TO_UNLOCK }).map((_, i) => (
            <li
              key={i}
              className="h-2 flex-1 rounded-full"
              style={{
                backgroundColor: i < responded ? "var(--gold)" : "var(--hair)",
              }}
            />
          ))}
        </ol>
        <p className="mt-5 text-[15px] leading-relaxed text-ink">
          {remaining === 1
            ? "Just one more read to go."
            : `${remaining} more reads to go.`}
        </p>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-[22px]">
        <Link
          href={`/a/${shareToken}`}
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Preview the observer link
        </Link>
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Back to your result to share it
        </Link>
      </div>
    </div>
  );
}
