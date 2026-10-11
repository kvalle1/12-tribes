import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { observerShareUrl } from "@/lib/observer/share-link";
import { MIN_OBSERVERS, hasEnoughObservers } from "@/lib/observer/constants";
import { ComparisonReport } from "@/components/comparison-report";
import { ObserverShareLink } from "@/components/observer-share-link";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). Login-gated like
 * the result page: an unauthenticated visitor is routed through sign-in, and a
 * signed-in user who hasn't taken the assessment is sent to start it.
 *
 * The report unlocks only once at least {@link MIN_OBSERVERS} Observers have
 * responded (ADR-0003) — that both makes the equal-weight average meaningful and
 * preserves each Observer's anonymity. Until then the page shows a clear locked
 * state with the Subject's share link so they can invite more people.
 */
export default async function ComparisonPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/compare")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponses(session.user.id);
  const shareUrl = await observerShareUrl(row.shareToken);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        {hasEnoughObservers(responses.length) ? (
          <ComparisonReport words={row.words} responses={responses} />
        ) : (
          <LockedState count={responses.length} shareUrl={shareUrl} />
        )}
      </div>
    </main>
  );
}

/**
 * Shown until at least {@link MIN_OBSERVERS} Observers have responded. States the
 * progress plainly and hands back the share link so the Subject can close the
 * gap, rather than hinting at partial results (which would weaken anonymity and
 * make the average misleading).
 */
function LockedState({
  count,
  shareUrl,
}: {
  count: number;
  shareUrl: string;
}) {
  const remaining = MIN_OBSERVERS - count;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        A 360 read
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,54px)] font-semibold leading-[1.04]">
        Not unlocked yet
      </h1>
      <p className="mt-5 max-w-[560px] text-[16px] leading-relaxed text-muted">
        Your comparison report opens once{" "}
        <span className="text-ink">at least {MIN_OBSERVERS} people</span> have
        answered. That keeps each response anonymous and the averaged read
        meaningful.
      </p>

      <div className="mt-10 rounded-[2px] border border-hair p-6">
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-[40px] leading-none text-gold">
            {count}
          </span>
          <span className="text-[14px] text-muted">
            of {MIN_OBSERVERS} responses so far
          </span>
        </div>
        <div
          className="mt-5 h-2 overflow-hidden rounded-full bg-hair/50"
          role="img"
          aria-label={`${count} of ${MIN_OBSERVERS} responses received`}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{ width: `${(count / MIN_OBSERVERS) * 100}%` }}
          />
        </div>
        <p className="mt-4 text-[14px] text-muted">
          {remaining === 1
            ? "Just one more response and your report unlocks."
            : `${remaining} more responses and your report unlocks.`}
        </p>
      </div>

      <section className="mt-12 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Invite more people
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
