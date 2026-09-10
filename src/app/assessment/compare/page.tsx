import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import {
  aggregateObservers,
  isReportUnlocked,
  OBSERVER_UNLOCK_THRESHOLD,
} from "@/lib/observer/aggregate";
import { score } from "@/lib/assessment/score";
import { ComparisonReport } from "@/components/comparison-report";
import { ObserverShareLink } from "@/components/observer-share-link";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). Login-gated:
 * an unauthenticated visitor is routed through sign-in, and a signed-in user who
 * hasn't taken the assessment is sent to start it.
 *
 * The report stays **locked until at least `OBSERVER_UNLOCK_THRESHOLD` Observers
 * have responded** — below that the "others" view is neither statistically
 * meaningful nor anonymous — showing progress and the share link instead. Once
 * unlocked, it computes the Subject's own profile and the equal-weight aggregate
 * on the server (scoring never reaches the client, ADR-0009) and hands both to
 * the presentational `ComparisonReport`.
 */
export default async function ComparePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/compare")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponses(session.user.id);
  const aggregate = aggregateObservers(responses);
  const unlocked = isReportUnlocked(aggregate.observerCount);

  const shareUrl = `${await observerLinkBase()}/a/${row.shareToken}`;

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
            self={score(row.words)}
            others={aggregate.others}
            perObserver={aggregate.perObserver}
            observerCount={aggregate.observerCount}
          />
        ) : (
          <LockedState
            count={aggregate.observerCount}
            needed={OBSERVER_UNLOCK_THRESHOLD}
            shareUrl={shareUrl}
          />
        )}
      </div>
    </main>
  );
}

/**
 * Pre-unlock state: how many Observers have responded, how many are still
 * needed, and the link to invite more. Kept deliberately encouraging rather than
 * bare, since the report only becomes meaningful at the threshold.
 */
function LockedState({
  count,
  needed,
  shareUrl,
}: {
  count: number;
  needed: number;
  shareUrl: string;
}) {
  const remaining = needed - count;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 report
      </p>
      <h1 className="mt-2 font-serif text-[clamp(30px,5vw,44px)] font-semibold leading-[1.08]">
        A few more reads to go
      </h1>
      <p className="mt-4 max-w-[520px] text-[16px] text-muted">
        Your comparison unlocks once{" "}
        <span className="text-ink">{needed} people</span> have anonymously
        described you. That keeps the “others” view meaningful — and keeps every
        single response anonymous.
      </p>

      <div className="mt-8 rounded-[2px] border border-hair p-6">
        <div className="flex items-baseline justify-between">
          <span className="font-serif text-[22px]">
            {count} of {needed} responses
          </span>
          <span className="text-[13px] text-muted">
            {remaining} more to unlock
          </span>
        </div>
        <div
          className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-hair/50"
          role="img"
          aria-label={`${count} of ${needed} observer responses received`}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{ width: `${Math.min((count / needed) * 100, 100)}%` }}
          />
        </div>
      </div>

      <section className="mt-12 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Invite more observers
        </p>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          Send this link to a few more people who know you well.
        </p>
        <ObserverShareLink url={shareUrl} />
      </section>
    </div>
  );
}

/**
 * The origin the shareable observer link is built against. Prefers the
 * configured `AUTH_URL` (trusted, set per deployment) so a forwarded `Host`
 * header can't skew the copied link; falls back to the request host for
 * local/dev where `AUTH_URL` may be unset, then to a relative path. Mirrors the
 * helper on the result page (issue #8).
 */
async function observerLinkBase(): Promise<string> {
  const configured = process.env.AUTH_URL?.replace(/\/+$/, "");
  if (configured) return configured;

  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  if (!host) return "";

  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}
