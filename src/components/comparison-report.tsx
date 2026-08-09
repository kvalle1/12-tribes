import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import {
  aggregateObservers,
  hasEnoughObservers,
  OBSERVER_UNLOCK_THRESHOLD,
} from "@/lib/assessment/aggregateObservers";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * against the equal-weight "others" profile aggregated from anonymous Observers,
 * with a short read on where the two views align and diverge, plus an anonymous
 * per-Observer drill-down.
 *
 * The report unlocks only once at least {@link OBSERVER_UNLOCK_THRESHOLD}
 * Observers have responded — before then it renders a locked state so the
 * "others" view is only ever shown in aggregate and no single Observer can be
 * singled out.
 *
 * Server component: it imports the `server-only` scoring core (the word→tribe
 * mapping never reaches the client). Render only from server components.
 */
export function ComparisonReport({
  selfWords,
  observerResponses,
}: {
  selfWords: string[];
  observerResponses: string[][];
}) {
  const observerCount = observerResponses.length;

  if (!hasEnoughObservers(observerCount)) {
    return <LockedReport count={observerCount} />;
  }

  const selfScores = score(selfWords);
  const othersScores = aggregateObservers(observerResponses);

  const othersBySlug = new Map(othersScores.map((s) => [s.slug, s.score]));

  // A shared scale across both columns so a longer bar always means a higher
  // normalized score, whichever profile it belongs to.
  const sharedMax = Math.max(
    0,
    ...selfScores.map((s) => s.score),
    ...othersScores.map((s) => s.score),
  );

  const rows = selfScores
    .map((s) => {
      const self = s.score;
      const others = othersBySlug.get(s.slug) ?? 0;
      return {
        slug: s.slug,
        name: s.name,
        self,
        others,
        delta: self - others,
        prominence: Math.max(self, others),
        mutual: Math.min(self, others),
      };
    })
    .sort((a, b) => b.prominence - a.prominence);

  const scored = rows.filter((r) => r.prominence > 0);
  const agreement = [...scored].sort((a, b) => b.mutual - a.mutual)[0];
  const divergence = [...scored].sort(
    (a, b) => Math.abs(b.delta) - Math.abs(a.delta),
  )[0];

  // Per-observer drill-down (PRD story 26): each anonymous Observer's strongest
  // reads. Ordered by a content-derived key (the Observer's ranked tribes), not
  // by when they responded, so the "Observer N" label leaks no submission-time
  // signal — the individual stays unidentifiable, which is exactly what the ≥3
  // unlock gate exists to protect (ADR-0003).
  const drilldown = observerResponses
    .map((words) => {
      const top = rankScores(score(words))
        .filter((t) => t.score > 0)
        .slice(0, 3);
      const orderKey = top
        .map((t) =>
          String(getTribeBySlug(t.slug)?.number ?? 99).padStart(2, "0"),
        )
        .join("-");
      return { top, orderKey };
    })
    .sort((a, b) => a.orderKey.localeCompare(b.orderKey));

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 comparison
      </p>
      <h1 className="mt-3 font-serif text-[clamp(30px,5vw,44px)] font-semibold leading-[1.05]">
        How you see yourself, and how others see you
      </h1>
      <p className="mt-3 max-w-[560px] text-[15px] text-muted">
        Your own profile is set against the combined read of{" "}
        <strong className="font-semibold text-ink">
          {observerCount} observers
        </strong>
        . Each observer counts equally, no matter how many words they chose.
      </p>

      {/* Alignment / divergence summary. */}
      {(agreement || divergence) && (
        <section className="mt-10 grid gap-4 sm:grid-cols-2">
          {agreement && (
            <SummaryCard
              label="Where you align"
              slug={agreement.slug}
              body={`You and your observers both read ${agreement.name} strongly.`}
            />
          )}
          {divergence && Math.abs(divergence.delta) > 0.0001 && (
            <SummaryCard
              label="Where you differ most"
              slug={divergence.slug}
              body={
                divergence.delta > 0
                  ? `You see more ${divergence.name} in yourself than others do.`
                  : `Others see more ${divergence.name} in you than you do.`
              }
            />
          )}
        </section>
      )}

      {/* Side-by-side bars: You vs Others, all twelve tribes. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-baseline justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            You vs others
          </p>
          <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.14em] text-faint">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-4 rounded-full bg-ink" /> You
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-4 rounded-full bg-muted/50" />{" "}
              Others
            </span>
          </div>
        </div>

        <ul className="mt-7 flex flex-col gap-6">
          {rows.map((row) => {
            const accent = accentHex(getTribeBySlug(row.slug)?.color ?? "");
            return (
              <li
                key={row.slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <span className="font-serif text-[17px] leading-tight">
                  {row.name}
                </span>
                <div className="flex flex-col gap-2">
                  <CompareBar
                    who="You"
                    score={row.self}
                    sharedMax={sharedMax}
                    color={accent}
                    tribe={row.name}
                  />
                  <CompareBar
                    who="Others"
                    score={row.others}
                    sharedMax={sharedMax}
                    color="var(--color-muted)"
                    muted
                    tribe={row.name}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Each observer&rsquo;s strongest reads, kept anonymous — no names, no
          relationships.
        </p>
        <ul className="mt-6 flex flex-col gap-4">
          {drilldown.map(({ top }, i) => {
            return (
              <li
                key={i}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-hair/60 pb-4 last:border-0"
              >
                <span className="w-[96px] shrink-0 text-[12px] uppercase tracking-[0.14em] text-faint">
                  Observer {i + 1}
                </span>
                <div className="flex flex-wrap gap-2">
                  {top.map((t) => {
                    const accent = accentHex(
                      getTribeBySlug(t.slug)?.color ?? "",
                    );
                    return (
                      <span
                        key={t.slug}
                        className="rounded-[2px] border px-2.5 py-1 text-[13px]"
                        style={{
                          borderColor: `${accent}66`,
                          backgroundColor: `${accent}14`,
                        }}
                      >
                        {t.name}
                      </span>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function CompareBar({
  who,
  score,
  sharedMax,
  color,
  muted,
  tribe,
}: {
  who: string;
  score: number;
  sharedMax: number;
  color: string;
  muted?: boolean;
  tribe: string;
}) {
  const relative = sharedMax > 0 ? score / sharedMax : 0;
  const pct = Math.round(score * 100);
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${who}: ${tribe} at ${pct}%`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(relative * 100, score > 0 ? 3 : 0)}%`,
            backgroundColor: color,
            opacity: muted ? 0.55 : 1,
          }}
        />
      </div>
      <span className="w-[36px] shrink-0 text-right text-[11px] tabular-nums text-faint">
        {pct}%
      </span>
    </div>
  );
}

function SummaryCard({
  label,
  slug,
  body,
}: {
  label: string;
  slug: string;
  body: string;
}) {
  const accent = accentHex(getTribeBySlug(slug)?.color ?? "");
  return (
    <div
      className="rounded-[3px] border border-hair p-5"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <p className="text-[11px] uppercase tracking-[0.18em] text-faint">
        {label}
      </p>
      <p className="mt-2 text-[15px] leading-snug text-ink">{body}</p>
    </div>
  );
}

function LockedReport({ count }: { count: number }) {
  const remaining = OBSERVER_UNLOCK_THRESHOLD - count;
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 comparison
      </p>
      <h1 className="mt-3 font-serif text-[clamp(30px,5vw,44px)] font-semibold leading-[1.05]">
        Not unlocked yet
      </h1>
      <p className="mt-4 max-w-[520px] text-[15px] text-muted">
        The comparison stays locked until at least{" "}
        {OBSERVER_UNLOCK_THRESHOLD} people have responded, so the &ldquo;others&rdquo;
        view is meaningful in aggregate and every observer stays anonymous.
      </p>
      <div className="mt-8 rounded-[3px] border border-hair p-6">
        <p className="text-[13px] uppercase tracking-[0.14em] text-faint">
          Responses so far
        </p>
        <p className="mt-2 font-serif text-[32px] font-semibold">
          {count} <span className="text-muted">/ {OBSERVER_UNLOCK_THRESHOLD}</span>
        </p>
        <p className="mt-3 text-[14px] text-muted">
          {remaining === 1
            ? "Just one more observer and your report unlocks."
            : `${remaining} more observers and your report unlocks.`}
        </p>
      </div>
    </div>
  );
}
