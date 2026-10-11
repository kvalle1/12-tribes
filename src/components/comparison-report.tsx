import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import { aggregateObservers, scoreObservers } from "@/lib/observer/aggregate";
import { buildComparison, type ComparisonRow } from "@/lib/observer/comparison";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile
 * alongside the equal-weight "others" profile, with the tribes where the two
 * reads align or diverge called out, and an anonymous per-Observer drill-down.
 *
 * Server component: it imports the `server-only` scoring core and aggregation, so
 * the word→tribe mapping never reaches the client (ADR-0009). It renders only
 * from the Subject's stored `words` and the anonymous Observer word lists —
 * nothing here can identify an Observer. The caller (the report page) is
 * responsible for the ≥3-Observer unlock gate; this component assumes it is only
 * rendered once unlocked.
 */
export function ComparisonReport({
  words,
  responses,
}: {
  words: string[];
  responses: string[][];
}) {
  const self = score(words);
  const others = aggregateObservers(responses);
  const rows = buildComparison(self, others);
  const perObserver = scoreObservers(responses);

  // Divergences worth naming: where others and self disagree most. A small floor
  // keeps noise (tribes near zero on both sides) out of the callouts.
  const GAP_FLOOR = 0.08;
  const divergences = [...rows]
    .filter((r) => Math.abs(r.gap) >= GAP_FLOOR)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 3);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        A 360 read · {responses.length}{" "}
        {responses.length === 1 ? "response" : "responses"}
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,54px)] font-semibold leading-[1.04]">
        How others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Your own read sits beside the people who answered, averaged so each voice
        counts the same. The gap between the two is where the most honest growth
        tends to live.
      </p>

      {/* Where the two reads diverge — the headline of the whole report. */}
      {divergences.length > 0 && (
        <section className="mt-12 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where your reads differ most
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            {divergences.map((row) => {
              const tribe = getTribeBySlug(row.slug);
              const accent = accentHex(tribe?.color ?? "");
              const othersHigher = row.gap > 0;
              return (
                <li
                  key={row.slug}
                  className="flex items-baseline gap-3 text-[15px]"
                >
                  <span
                    className="font-serif text-[18px] leading-none"
                    style={{ color: accent }}
                  >
                    {row.name}
                  </span>
                  <span className="text-muted">
                    {othersHigher
                      ? "others see this in you more strongly than you do"
                      : "you claim this more strongly than others see it"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Self vs others, side by side, across all twelve tribes. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-center justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            You vs. others
          </p>
          <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.12em] text-faint">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink" />
              You
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink/35" />
              Others
            </span>
          </div>
        </div>
        <ul className="mt-6 flex flex-col gap-5">
          {rows.map((row) => (
            <CompareRow key={row.slug} row={row} />
          ))}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down. Native <details> keeps this a server
          component — no client JS — while staying keyboard-accessible. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each response, anonymously
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Every response is fully anonymous — numbered only, with nothing that
          identifies who answered.
        </p>
        <ul className="mt-5 flex flex-col gap-2.5">
          {perObserver.map((profile, i) => {
            const ranked = rankScores(profile).slice(0, 3);
            return (
              <li key={i}>
                <details className="group rounded-[2px] border border-hair">
                  <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-[14px] text-ink">
                    <span className="font-serif text-[16px]">
                      Observer {i + 1}
                    </span>
                    <span className="text-[11px] uppercase tracking-[0.12em] text-faint group-open:hidden">
                      Show read
                    </span>
                    <span className="hidden text-[11px] uppercase tracking-[0.12em] text-faint group-open:inline">
                      Hide
                    </span>
                  </summary>
                  <div className="border-t border-hair px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
                      Their top tribes
                    </p>
                    <ul className="mt-3 flex flex-col gap-2.5">
                      {ranked.map((r) => {
                        const tribe = getTribeBySlug(r.slug);
                        const accent = accentHex(tribe?.color ?? "");
                        return (
                          <li
                            key={r.slug}
                            className="grid grid-cols-[110px_1fr] items-center gap-3 max-[520px]:grid-cols-[88px_1fr]"
                          >
                            <span className="font-serif text-[15px] leading-none">
                              {r.name}
                            </span>
                            <Bar fraction={r.relative} color={accent} />
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/** One tribe's paired self/others bars on the shared scale. */
function CompareRow({ row }: { row: ComparisonRow }) {
  const tribe = getTribeBySlug(row.slug);
  const accent = accentHex(tribe?.color ?? "");
  return (
    <li className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]">
      <span className="font-serif text-[17px] leading-tight">{row.name}</span>
      <div className="flex flex-col gap-1.5">
        <LabeledBar
          label="You"
          fraction={row.selfRelative}
          color={accent}
          opacity={1}
        />
        <LabeledBar
          label="Others"
          fraction={row.othersRelative}
          color={accent}
          opacity={0.4}
        />
      </div>
    </li>
  );
}

function LabeledBar({
  label,
  fraction,
  color,
  opacity,
}: {
  label: string;
  fraction: number;
  color: string;
  opacity: number;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[42px] shrink-0 text-[10px] uppercase tracking-[0.1em] text-faint">
        {label}
      </span>
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${Math.round(fraction * 100)}% of the top score`}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(fraction * 100, fraction > 0 ? 3 : 0)}%`,
            backgroundColor: color,
            opacity,
          }}
        />
      </div>
    </div>
  );
}

function Bar({ fraction, color }: { fraction: number; color: string }) {
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={`${Math.round(fraction * 100)}% of their top score`}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.max(fraction * 100, fraction > 0 ? 3 : 0)}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}
