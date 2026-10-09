import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  isReportUnlocked,
  MIN_OBSERVERS_FOR_REPORT,
} from "@/lib/assessment/aggregate-observers";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { observerShareUrl } from "@/lib/observer/share-link";
import { ObserverShareLink } from "@/components/observer-share-link";
import {
  ComparisonReport,
  type ComparisonRow,
  type ObserverSummary,
} from "@/components/comparison-report";

/** How many of an observer's tribes to surface in the anonymous drill-down. */
const TOP_TRIBES_PER_OBSERVER = 3;

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). Login-gated:
 * an unauthenticated visitor routes through sign-in, and a signed-in user who
 * hasn't taken the assessment is sent to start it (they need their own result,
 * and its share link, before observers can respond).
 *
 * The report unlocks only once at least `MIN_OBSERVERS_FOR_REPORT` observers
 * have responded; before then it shows a clear locked state with progress and
 * the share link to invite more. All scoring/aggregation runs here on the server
 * (the `server-only` core) and only plain numbers are handed to the view, so the
 * word→tribe mapping never reaches the client (ADR-0009).
 */
export default async function ComparisonReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponses(session.user.id);
  const { count, others, perObserver } = aggregateObservers(responses);
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

        {isReportUnlocked(count) ? (
          <ComparisonReport
            observerCount={count}
            rows={buildRows(row.words, others)}
            observers={buildObserverSummaries(perObserver)}
          />
        ) : (
          <LockedReport count={count} shareUrl={shareUrl} />
        )}
      </div>
    </main>
  );
}

/** Pair the Subject's own profile with the aggregated "others" profile per tribe. */
function buildRows(
  selfWords: string[],
  others: { slug: string; score: number }[],
): ComparisonRow[] {
  const selfBySlug = new Map(score(selfWords).map((s) => [s.slug, s.score]));
  const othersBySlug = new Map(others.map((o) => [o.slug, o.score]));

  return others.map((o) => {
    const tribe = getTribeBySlug(o.slug);
    return {
      slug: o.slug,
      name: tribe?.name ?? o.slug,
      accent: accentHex(tribe?.color ?? ""),
      self: selfBySlug.get(o.slug) ?? 0,
      others: othersBySlug.get(o.slug) ?? 0,
    };
  });
}

/** Build the anonymous, positionally-labeled per-observer drill-down. */
function buildObserverSummaries(
  perObserver: { slug: string; name: string; score: number }[][],
): ObserverSummary[] {
  return perObserver.map((observer, i) => {
    const ranked = [...observer]
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_TRIBES_PER_OBSERVER);
    const top = ranked[0]?.score ?? 0;

    return {
      label: `Observer ${i + 1}`,
      top: ranked.map((s) => {
        const tribe = getTribeBySlug(s.slug);
        return {
          slug: s.slug,
          name: tribe?.name ?? s.slug,
          accent: accentHex(tribe?.color ?? ""),
          relative: top > 0 ? s.score / top : 0,
        };
      }),
    };
  });
}

/** The pre-unlock state: how far along, and the link to invite more observers. */
function LockedReport({ count, shareUrl }: { count: number; shareUrl: string }) {
  const remaining = MIN_OBSERVERS_FOR_REPORT - count;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 comparison
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        A few more reads to go
      </h1>
      <p className="mt-3 max-w-[560px] text-[16px] text-muted">
        Your comparison unlocks once{" "}
        <span className="text-ink">at least {MIN_OBSERVERS_FOR_REPORT}</span>{" "}
        people have described you. That keeps the “others” view meaningful and
        every observer anonymous.
      </p>

      <div className="mt-8 flex items-center gap-3" aria-hidden>
        {Array.from({ length: MIN_OBSERVERS_FOR_REPORT }).map((_, i) => (
          <span
            key={i}
            className={`h-2.5 flex-1 rounded-full ${
              i < count ? "bg-gold" : "bg-hair/60"
            }`}
          />
        ))}
      </div>
      <p className="mt-3 text-[14px] text-muted">
        {count === 0
          ? "No observers yet."
          : `${count} of ${MIN_OBSERVERS_FOR_REPORT} responded.`}{" "}
        {remaining > 0 && (
          <span className="text-ink">
            {remaining} more {remaining === 1 ? "response" : "responses"} to
            unlock.
          </span>
        )}
      </p>

      <section className="mt-12 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Invite more observers
        </p>
        <h2 className="mt-2 font-serif text-[22px] font-semibold leading-snug">
          Share your link
        </h2>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          Send this to people who know you well. Each one anonymously picks the
          words that describe you.
        </p>
        <ObserverShareLink url={shareUrl} />
      </section>
    </div>
  );
}
