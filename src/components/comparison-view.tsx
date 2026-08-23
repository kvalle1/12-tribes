import { accentHex, getTribeBySlug } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import type { AggregatedObservers } from "@/lib/observer/aggregate";

/**
 * The 360 comparison report (issue #9): the Subject's own profile alongside the
 * equal-weight aggregated "others" profile, the tribes where the two most align
 * and most diverge, and an anonymous per-observer drill-down (Observer 1/2/3 …).
 *
 * Presentation only — it receives already-computed, normalized scores and does
 * no scoring itself, so it carries no `server-only` weight and never touches the
 * word→tribe mapping. Both profiles are drawn against one shared scale so the
 * "you" and "others" bars are directly comparable.
 */

/** Ignore scores at or below this when picking alignment/divergence highlights. */
const PRESENCE_EPSILON = 1e-6;

interface CompareRow {
  slug: string;
  name: string;
  self: number;
  others: number;
  /** self − others: positive ⇒ you read it stronger; negative ⇒ others do. */
  gap: number;
}

export function ComparisonView({
  self,
  aggregate,
}: {
  self: TribeScore[];
  aggregate: AggregatedObservers;
}) {
  const othersBySlug = new Map(
    aggregate.average.map((a) => [a.slug, a.score]),
  );

  const rows: CompareRow[] = self
    .map((s) => {
      const others = othersBySlug.get(s.slug) ?? 0;
      return { slug: s.slug, name: s.name, self: s.score, others, gap: s.score - others };
    })
    // Strongest reading first (whichever of self/others is higher).
    .sort((a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others));

  const maxScore = Math.max(
    PRESENCE_EPSILON,
    ...rows.flatMap((r) => [r.self, r.others]),
  );

  const present = rows.filter(
    (r) => r.self > PRESENCE_EPSILON || r.others > PRESENCE_EPSILON,
  );
  const divergences = [...present]
    .filter((r) => Math.abs(r.gap) > PRESENCE_EPSILON)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 3);
  const alignments = [...present]
    .sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap))
    .slice(0, 2);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 · {aggregate.observerCount}{" "}
        {aggregate.observerCount === 1 ? "observer" : "observers"}
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,54px)] font-semibold leading-[1.04]">
        You, and how others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        Your own reading sits beside the equal-weight average of everyone who
        described you — each observer counts the same, however many words they
        picked. The gap between the two is where the most useful insight lives.
      </p>

      {/* Side-by-side bars for all twelve tribes on one shared scale. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-center justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Tribe by tribe
          </p>
          <Legend />
        </div>
        <ul className="mt-6 flex flex-col gap-5">
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
                <div className="flex flex-col gap-1.5">
                  <CompareBar
                    label="You"
                    value={row.self}
                    max={maxScore}
                    accent={accent}
                    solid
                  />
                  <CompareBar
                    label="Others"
                    value={row.others}
                    max={maxScore}
                    accent={accent}
                    solid={false}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Where the two readings agree and disagree most. */}
      <section className="mt-14 grid grid-cols-2 gap-8 border-t border-hair pt-8 max-[520px]:grid-cols-1">
        <div>
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where you align
          </p>
          <ul className="mt-4 flex flex-col gap-3">
            {alignments.length === 0 && (
              <li className="text-[14px] text-muted">Not enough signal yet.</li>
            )}
            {alignments.map((r) => (
              <li key={r.slug} className="text-[15px] text-ink">
                <span
                  className="font-serif"
                  style={{ color: accentHex(getTribeBySlug(r.slug)?.color ?? "") }}
                >
                  {r.name}
                </span>{" "}
                — you and your observers read this about the same.
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where you diverge
          </p>
          <ul className="mt-4 flex flex-col gap-3">
            {divergences.length === 0 && (
              <li className="text-[14px] text-muted">
                No meaningful divergence — a close read all round.
              </li>
            )}
            {divergences.map((r) => (
              <li key={r.slug} className="text-[15px] text-ink">
                <span
                  className="font-serif"
                  style={{ color: accentHex(getTribeBySlug(r.slug)?.color ?? "") }}
                >
                  {r.name}
                </span>{" "}
                —{" "}
                {r.gap > 0
                  ? "you see more of this in yourself than others do."
                  : "others see more of this in you than you do."}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <details className="group">
          <summary className="cursor-pointer list-none text-[12px] uppercase tracking-[0.2em] text-faint transition-colors hover:text-ink">
            <span className="group-open:hidden">Show individual observers ▾</span>
            <span className="hidden group-open:inline">Hide individual observers ▴</span>
          </summary>
          <p className="mt-4 max-w-[520px] text-[14px] text-muted">
            Each observer is fully anonymous — only their reading of you is shown,
            never who they are.
          </p>
          <ul className="mt-6 flex flex-col gap-6">
            {aggregate.observers.map((observer) => {
              const top = [...observer.scores]
                .sort((a, b) => b.score - a.score)
                .filter((s) => s.score > PRESENCE_EPSILON)
                .slice(0, 3);
              const observerMax = top.length > 0 ? top[0].score : PRESENCE_EPSILON;
              return (
                <li key={observer.index}>
                  <p className="text-[13px] uppercase tracking-[0.16em] text-ink">
                    Observer {observer.index}
                  </p>
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {top.length === 0 && (
                      <li className="text-[14px] text-muted">No clear signal.</li>
                    )}
                    {top.map((s) => (
                      <li
                        key={s.slug}
                        className="grid grid-cols-[110px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
                      >
                        <span className="text-[14px] text-muted">{s.name}</span>
                        <Bar
                          fraction={s.score / observerMax}
                          accent={accentHex(getTribeBySlug(s.slug)?.color ?? "")}
                          solid
                          ariaLabel={`Observer ${observer.index}, ${s.name}`}
                        />
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </details>
      </section>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.14em] text-faint">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-4 rounded-full bg-ink" />
        You
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-4 rounded-full border border-ink/40 bg-ink/20" />
        Others
      </span>
    </div>
  );
}

function CompareBar({
  label,
  value,
  max,
  accent,
  solid,
}: {
  label: string;
  value: number;
  max: number;
  accent: string;
  solid: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-[52px] shrink-0 text-[10px] uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
      <Bar
        fraction={value / max}
        accent={accent}
        solid={solid}
        ariaLabel={`${label}: ${Math.round((value / max) * 100)}% of the strongest reading`}
      />
    </div>
  );
}

function Bar({
  fraction,
  accent,
  solid,
  ariaLabel,
}: {
  fraction: number;
  accent: string;
  solid: boolean;
  ariaLabel: string;
}) {
  const pct = Math.max(fraction * 100, fraction > 0 ? 3 : 0);
  return (
    <div
      className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={ariaLabel}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${pct}%`,
          backgroundColor: accent,
          opacity: solid ? 1 : 0.4,
        }}
      />
    </div>
  );
}
