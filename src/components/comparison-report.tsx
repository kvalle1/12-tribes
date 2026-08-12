import { accentHex, getTribeBySlug, type Tribe } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import { compareProfiles, type TribeComparison } from "@/lib/observer/comparison";
import { ObserverDrilldown } from "./observer-drilldown";

/**
 * The 360 self-vs-others comparison report (issue #9). It shows the Subject's
 * own profile beside the equal-weight "others" profile, calls out where the two
 * most agree and diverge, and offers an anonymous per-observer drill-down.
 *
 * All inputs are plain scored numbers (`TribeScore[]`) computed server-side —
 * this component only reshapes and renders them, so it carries no scoring or
 * server-only import and the word→tribe mapping never reaches the client.
 *
 * `gap = self − others`: a positive gap is a tribe the Subject claims more than
 * others see (a possible blind spot); a negative gap is one others read more
 * strongly than the Subject does. The gap threshold below keeps trivially small
 * differences out of the "where you diverge" callouts.
 */
const DIVERGENCE_THRESHOLD = 0.08;

export function ComparisonReport({
  self,
  others,
  perObserver,
  observerCount,
}: {
  self: TribeScore[];
  others: TribeScore[];
  perObserver: TribeScore[][];
  observerCount: number;
}) {
  const rows = compareProfiles(self, others);

  // Order the paired bars by the stronger of the two sides, so the tribes that
  // matter to either view rise to the top.
  const byStrength = [...rows].sort(
    (a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others),
  );
  const maxScore = Math.max(1e-9, ...rows.flatMap((r) => [r.self, r.others]));

  const youMore = rows
    .filter((r) => r.gap >= DIVERGENCE_THRESHOLD)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3);
  const othersMore = rows
    .filter((r) => r.gap <= -DIVERGENCE_THRESHOLD)
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 3);

  // Alignment: tribes both sides rate meaningfully and close together.
  const aligned = rows
    .filter(
      (r) =>
        r.self > 0 &&
        r.others > 0 &&
        Math.abs(r.gap) < DIVERGENCE_THRESHOLD &&
        Math.max(r.self, r.others) >= 0.4 * maxScore,
    )
    .sort((a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others))
    .slice(0, 3);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 reflection
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,52px)] font-semibold leading-[1.05]">
        You, and how others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[16px] text-muted">
        Based on {observerCount} anonymous{" "}
        {observerCount === 1 ? "reflection" : "reflections"}. Each observer is
        weighted equally, so no single voice dominates. The gap between the two
        columns is where the most useful insight usually lives.
      </p>

      {/* Side-by-side ranking bars: your read vs the others' aggregate. */}
      <section className="mt-12 border-t border-hair pt-8">
        <div className="flex items-center gap-6 text-[11px] uppercase tracking-[0.16em]">
          <LegendSwatch className="bg-ink" label="You" />
          <LegendSwatch className="bg-gold" label="Others" />
        </div>

        <ul className="mt-6 flex flex-col gap-5">
          {byStrength.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li key={row.slug} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="font-serif text-[17px] leading-none">
                    {row.name}
                  </span>
                  {Math.abs(row.gap) >= DIVERGENCE_THRESHOLD && (
                    <span className="text-[10px] uppercase tracking-[0.14em] text-faint">
                      {row.gap > 0 ? "You see more" : "Others see more"}
                    </span>
                  )}
                </div>
                <PairedBar label="You" value={row.self} max={maxScore} color={accent} solid />
                <PairedBar label="Others" value={row.others} max={maxScore} color={accent} />
              </li>
            );
          })}
        </ul>
      </section>

      {/* Alignment & divergence callouts. */}
      <section className="mt-14 grid grid-cols-1 gap-8 border-t border-hair pt-8 sm:grid-cols-2">
        <div>
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where you agree
          </p>
          {aligned.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-2">
              {aligned.map((row) => (
                <CalloutRow key={row.slug} row={row} tribe={getTribeBySlug(row.slug)} />
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-[15px] text-muted">
              You and your observers don&rsquo;t strongly converge on any one
              tribe — the divergences below tell the story.
            </p>
          )}
        </div>

        <div>
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where you diverge
          </p>
          {youMore.length + othersMore.length > 0 ? (
            <div className="mt-4 flex flex-col gap-5">
              {youMore.length > 0 && (
                <div>
                  <p className="text-[13px] text-ink">You claim more than others see</p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {youMore.map((row) => (
                      <CalloutRow key={row.slug} row={row} tribe={getTribeBySlug(row.slug)} />
                    ))}
                  </ul>
                </div>
              )}
              {othersMore.length > 0 && (
                <div>
                  <p className="text-[13px] text-ink">Others see more than you claim</p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {othersMore.map((row) => (
                      <CalloutRow key={row.slug} row={row} tribe={getTribeBySlug(row.slug)} />
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-4 text-[15px] text-muted">
              Your self-read and your observers&rsquo; read line up closely — no
              significant blind spots surfaced.
            </p>
          )}
        </div>
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <h2 className="mt-2 font-serif text-[22px] font-semibold leading-snug">
          The spread of opinion
        </h2>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          Each observer&rsquo;s own read, fully anonymous. Numbers only — nothing
          ties a column back to a person.
        </p>
        <div className="mt-6">
          <ObserverDrilldown perObserver={perObserver} />
        </div>
      </section>
    </div>
  );
}

function PairedBar({
  label,
  value,
  max,
  color,
  solid = false,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  solid?: boolean;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="grid grid-cols-[52px_1fr] items-center gap-3">
      <span className="text-[10px] uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
      <div className="h-2.5 overflow-hidden rounded-full bg-hair/50">
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(pct, value > 0 ? 3 : 0)}%`,
            backgroundColor: color,
            opacity: solid ? 1 : 0.5,
          }}
        />
      </div>
    </div>
  );
}

function CalloutRow({
  row,
  tribe,
}: {
  row: TribeComparison;
  tribe: Tribe | undefined;
}) {
  const accent = accentHex(tribe?.color ?? "");
  return (
    <li className="flex items-center gap-2.5 text-[15px] text-ink">
      <span
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: accent }}
        aria-hidden
      />
      <span className="font-serif text-[17px]">{row.name}</span>
    </li>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2 text-faint">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${className}`} aria-hidden />
      {label}
    </span>
  );
}
