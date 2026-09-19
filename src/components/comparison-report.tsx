import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { rankScores } from "@/lib/assessment/ranking";
import type { TribeScore } from "@/lib/assessment/score";
import type { ObserverAggregate } from "@/lib/observer/aggregate";
import { OBSERVER_UNLOCK_THRESHOLD } from "@/lib/observer/aggregate";

/**
 * The self-vs-others 360 comparison report (issue #9, ADR-0003). Presentational
 * only — it takes the Subject's own tribe scores and the pre-computed
 * `aggregateObservers` result, so it holds no scoring logic and no word→tribe
 * mapping (both stay server-side, ADR-0009).
 *
 * Below the unlock threshold it renders a clear locked state instead of the
 * report, keeping individual Observers anonymous until enough have responded.
 * Above it, it shows the Subject's profile beside the equal-weight "others"
 * profile, highlights where they align and diverge, and offers an anonymous
 * per-observer drill-down (Observer 1 / 2 / 3…).
 */

/** A meaningful score floor — below this a tribe is treated as "not really scored". */
const NOISE = 0.05;

export function ComparisonReport({
  self,
  aggregate,
}: {
  self: TribeScore[];
  aggregate: ObserverAggregate;
}) {
  const { count, others, perObserver } = aggregate;

  if (count < OBSERVER_UNLOCK_THRESHOLD) {
    return <LockedState count={count} />;
  }

  const selfBySlug = new Map(self.map((s) => [s.slug, s.score]));
  const scale = Math.max(
    ...self.map((s) => s.score),
    ...others.map((s) => s.score),
    NOISE,
  );

  // One row per tribe, carrying both profiles and the gap between them.
  const rows = others.map((o) => {
    const selfScore = selfBySlug.get(o.slug) ?? 0;
    return {
      slug: o.slug,
      name: o.name,
      self: selfScore,
      others: o.score,
      delta: o.score - selfScore, // + ⇒ others see it more; − ⇒ you see it more
    };
  });

  // Display order: most salient tribe (by either view) first.
  const ordered = [...rows].sort(
    (a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others),
  );

  const divergences = [...rows]
    .filter((r) => Math.abs(r.delta) >= NOISE * 2)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);

  const alignments = [...rows]
    .filter((r) => (r.self >= NOISE || r.others >= NOISE) && Math.abs(r.delta) < NOISE)
    .sort((a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others))
    .slice(0, 3);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        How others see you
      </p>
      <h2 className="mt-2 font-serif text-[28px] font-semibold leading-tight">
        You, and the room
      </h2>
      <p className="mt-2 max-w-[520px] text-[15px] text-muted">
        Drawn from{" "}
        <span className="text-ink">{count} anonymous responses</span>, each
        weighted equally. The gap between the two reads is where the most useful
        insight usually lives.
      </p>

      {/* Legend */}
      <div className="mt-6 flex items-center gap-6 text-[11px] uppercase tracking-[0.14em] text-faint">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full bg-gold" />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full border border-ink/40 bg-ink/25" />
          Others
        </span>
      </div>

      {/* Paired bars — your profile beside the aggregated "others" profile. */}
      <ul className="mt-6 flex flex-col gap-5">
        {ordered.map((row) => (
          <li
            key={row.slug}
            className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
          >
            <span className="font-serif text-[17px] leading-none">
              {row.name}
            </span>
            <div className="flex flex-col gap-1.5">
              <CompareBar
                label="You"
                value={row.self}
                scale={scale}
                color="var(--gold)"
              />
              <CompareBar
                label="Others"
                value={row.others}
                scale={scale}
                color="var(--ink)"
                muted
              />
            </div>
          </li>
        ))}
      </ul>

      {/* Alignment / divergence callouts. */}
      <div className="mt-12 grid grid-cols-2 gap-5 max-[520px]:grid-cols-1">
        <section className="rounded-[2px] border border-hair p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
            Where you diverge
          </p>
          {divergences.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-2.5 text-[14px] text-ink">
              {divergences.map((row) => (
                <li key={row.slug}>
                  <span className="font-serif text-[15px]">{row.name}</span> —{" "}
                  <span className="text-muted">
                    {row.delta > 0
                      ? "others see this in you more than you do"
                      : "you claim this more than others see it"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[14px] text-muted">
              No large gaps — your read and theirs mostly line up.
            </p>
          )}
        </section>

        <section className="rounded-[2px] border border-hair p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
            Where you agree
          </p>
          {alignments.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-2.5 text-[14px] text-ink">
              {alignments.map((row) => (
                <li key={row.slug}>
                  <span className="font-serif text-[15px]">{row.name}</span> —{" "}
                  <span className="text-muted">seen the same by both</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[14px] text-muted">
              Little overlap yet between how you and others scored.
            </p>
          )}
        </section>
      </div>

      <ObserverDrilldown perObserver={perObserver} />
    </div>
  );
}

/** A single comparison bar, scaled against the largest score across both views. */
function CompareBar({
  label,
  value,
  scale,
  color,
  muted = false,
}: {
  label: string;
  value: number;
  scale: number;
  color: string;
  muted?: boolean;
}) {
  const pct = scale > 0 ? (value / scale) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-[46px] shrink-0 text-[10px] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${Math.round(value * 100)}%`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(pct, value > 0 ? 3 : 0)}%`,
            backgroundColor: color,
            opacity: muted ? 0.32 : 1,
          }}
        />
      </div>
    </div>
  );
}

/**
 * Anonymous per-observer breakdown. Each Observer is shown only as a position
 * ("Observer 1", "Observer 2"…) with the tribes their words leaned toward — no
 * name, no relationship, nothing that could identify who they are (ADR-0003).
 */
function ObserverDrilldown({ perObserver }: { perObserver: TribeScore[][] }) {
  return (
    <section className="mt-12 border-t border-hair pt-8">
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Observer by observer
      </p>
      <p className="mt-2 max-w-[520px] text-[14px] text-muted">
        The spread behind the average — each response on its own, fully
        anonymous.
      </p>
      <ul className="mt-6 flex flex-col gap-5">
        {perObserver.map((profile, i) => {
          const top = rankScores(profile)
            .filter((r) => r.score > 0)
            .slice(0, 3);
          return (
            <li key={i} className="rounded-[2px] border border-hair p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
                Observer {i + 1}
              </p>
              {top.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2.5">
                  {top.map((row) => {
                    const tribe = getTribeBySlug(row.slug);
                    const accent = accentHex(tribe?.color ?? "");
                    return (
                      <li
                        key={row.slug}
                        className="flex items-center gap-2 rounded-[2px] border border-hair px-3 py-1.5 text-[14px]"
                      >
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: accent }}
                          aria-hidden
                        />
                        {row.name}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-3 text-[14px] text-muted">No clear lean.</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The pre-unlock state: a clear, calm placeholder explaining the report opens
 * only once at least {OBSERVER_UNLOCK_THRESHOLD} people have responded, with the
 * running count so the Subject knows how close they are.
 */
function LockedState({ count }: { count: number }) {
  const remaining = OBSERVER_UNLOCK_THRESHOLD - count;
  return (
    <div className="rounded-[2px] border border-hair bg-white/40 p-8">
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        How others see you
      </p>
      <h2 className="mt-2 font-serif text-[26px] font-semibold leading-tight">
        Locked for now
      </h2>
      <p className="mt-3 max-w-[480px] text-[15px] text-muted">
        Your comparison report opens once{" "}
        <span className="text-ink">
          at least {OBSERVER_UNLOCK_THRESHOLD} people
        </span>{" "}
        have shared their read of you. Keeping it closed until then makes the
        &ldquo;others&rdquo; view meaningful and keeps every response anonymous.
      </p>

      <div className="mt-6 flex items-center gap-2" aria-hidden>
        {Array.from({ length: OBSERVER_UNLOCK_THRESHOLD }).map((_, i) => (
          <span
            key={i}
            className={`h-2.5 w-10 rounded-full ${
              i < count ? "bg-gold" : "bg-hair"
            }`}
          />
        ))}
      </div>
      <p className="mt-3 text-[14px] text-muted">
        <span className="text-ink">{count}</span> of{" "}
        {OBSERVER_UNLOCK_THRESHOLD} responded
        {remaining > 0 && (
          <>
            {" "}
            — {remaining} more to go.
          </>
        )}
      </p>
    </div>
  );
}
