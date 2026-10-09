/**
 * The self-vs-others 360 comparison view (issue #9). Renders the Subject's own
 * profile alongside the equal-weight aggregated "others" profile as paired
 * ranking bars, flags where the two views align or diverge, and lists the
 * anonymous per-observer breakdown ("Observer 1", "Observer 2", …).
 *
 * It is a pure presentational component: the page computes the scored/aggregated
 * numbers (via the `server-only` scoring core) and passes plain data down, so no
 * scoring logic or word→tribe mapping reaches the client (ADR-0009).
 */

/** One tribe's paired self/others scores, each a 0–1 normalized value. */
export interface ComparisonRow {
  slug: string;
  name: string;
  accent: string;
  self: number;
  others: number;
}

/** An anonymous single-observer summary — positional label, no identity. */
export interface ObserverSummary {
  label: string;
  top: { slug: string; name: string; accent: string; relative: number }[];
}

/** Gap (in fraction-of-top-score points) past which a tribe counts as divergent. */
const DIVERGENCE_THRESHOLD = 0.15;

export function ComparisonReport({
  observerCount,
  rows,
  observers,
}: {
  observerCount: number;
  rows: ComparisonRow[];
  observers: ObserverSummary[];
}) {
  // Scale every bar against the single largest score across both profiles, so
  // the chart stays readable while keeping self and others on one shared axis.
  const max = rows.reduce((m, r) => Math.max(m, r.self, r.others), 0);
  const frac = (v: number) => (max > 0 ? v / max : 0);

  // Anchor the ordering on the stronger of the two views so the tribes that
  // matter to either side rise to the top.
  const ranked = [...rows].sort(
    (a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others),
  );

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 comparison
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        How others see you
      </h1>
      <p className="mt-3 max-w-[560px] text-[16px] text-muted">
        Your own read sits beside the combined read of your{" "}
        {observerCount} observers. Each observer counts equally, so no single
        voice dominates. The gaps — where others see more or less of a tribe than
        you do — are where the most useful insight lives.
      </p>

      <Legend />

      <section className="mt-8 border-t border-hair pt-8">
        <ul className="flex flex-col gap-5">
          {ranked.map((row) => (
            <ComparisonBars
              key={row.slug}
              row={row}
              selfFrac={frac(row.self)}
              othersFrac={frac(row.others)}
            />
          ))}
        </ul>
      </section>

      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each observer, anonymously
        </p>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          The top tribes each observer saw in you. Responses are fully anonymous
          — numbered only, with nothing tying them back to a person.
        </p>
        <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {observers.map((observer) => (
            <li
              key={observer.label}
              className="rounded-[2px] border border-hair p-5"
            >
              <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
                {observer.label}
              </div>
              <ul className="mt-3 flex flex-col gap-2.5">
                {observer.top.map((tribe) => (
                  <li
                    key={tribe.slug}
                    className="grid grid-cols-[86px_1fr] items-center gap-3"
                  >
                    <span className="font-serif text-[15px]">{tribe.name}</span>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-hair/50"
                      role="img"
                      aria-label={`${tribe.name}: ${Math.round(tribe.relative * 100)}% of this observer's top score`}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(tribe.relative * 100, 4)}%`,
                          backgroundColor: tribe.accent,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ComparisonBars({
  row,
  selfFrac,
  othersFrac,
}: {
  row: ComparisonRow;
  selfFrac: number;
  othersFrac: number;
}) {
  const delta = othersFrac - selfFrac;
  const divergent = Math.abs(delta) >= DIVERGENCE_THRESHOLD;
  const note = !divergent
    ? "In sync"
    : delta > 0
      ? "Others see more"
      : "You see more";

  return (
    <li className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]">
      <span
        className="font-serif text-[17px] leading-tight"
        style={{ color: divergent ? row.accent : undefined }}
      >
        {row.name}
      </span>
      <div className="flex flex-col gap-1.5">
        <Bar
          label="You"
          frac={selfFrac}
          accent={row.accent}
          solid
          ariaLabel={`You scored ${row.name} at ${Math.round(selfFrac * 100)}% of the top score`}
        />
        <Bar
          label="Others"
          frac={othersFrac}
          accent={row.accent}
          solid={false}
          ariaLabel={`Your observers scored ${row.name} at ${Math.round(othersFrac * 100)}% of the top score`}
        />
        <span
          className={`mt-0.5 text-[10px] uppercase tracking-[0.14em] ${
            divergent ? "text-ink" : "text-faint"
          }`}
        >
          {note}
        </span>
      </div>
    </li>
  );
}

function Bar({
  label,
  frac,
  accent,
  solid,
  ariaLabel,
}: {
  label: string;
  frac: number;
  accent: string;
  solid: boolean;
  ariaLabel: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-[46px] shrink-0 text-[10px] uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={ariaLabel}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(frac * 100, frac > 0 ? 3 : 0)}%`,
            backgroundColor: accent,
            opacity: solid ? 1 : 0.4,
          }}
        />
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-6 flex items-center gap-6 text-[11px] uppercase tracking-[0.14em] text-muted">
      <span className="flex items-center gap-2">
        <span className="h-2.5 w-7 rounded-full bg-ink" />
        You
      </span>
      <span className="flex items-center gap-2">
        <span className="h-2.5 w-7 rounded-full bg-ink/40" />
        Others
      </span>
    </div>
  );
}
