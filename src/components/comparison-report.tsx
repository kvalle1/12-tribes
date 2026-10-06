import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import {
  aggregateObservers,
  compareProfiles,
  DIVERGENCE_HIGHLIGHT,
  type ComparisonRow,
} from "@/lib/assessment/aggregate";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own Self
 * Assessment profile next to the equal-weight aggregated "others" profile, with
 * the tribes where the two reads diverge most called out, plus an anonymous
 * per-observer drill-down.
 *
 * Server component — it imports the scoring core and the observers' raw words,
 * both server-only (ADR-0009). The caller gates rendering on at least
 * `MIN_OBSERVERS_TO_UNLOCK` responses; this component assumes the report is
 * unlocked and draws from the aggregate directly.
 */
export function ComparisonReport({
  words,
  observerResponses,
}: {
  words: string[];
  observerResponses: string[][];
}) {
  const self = score(words);
  const aggregate = aggregateObservers(observerResponses);
  const rows = compareProfiles(self, aggregate.others);

  // Blind spots: tribes others see in the Subject more strongly than the Subject
  // sees themselves. Hidden claims: tribes the Subject rates above how others
  // read them. Both measured on the shared scale (relative gap) and only when
  // the gap clears the highlight threshold.
  const relGap = (row: ComparisonRow) => row.othersRelative - row.selfRelative;
  const notable = rows.filter(
    (row) => Math.abs(relGap(row)) >= DIVERGENCE_HIGHLIGHT,
  );
  const blindSpot = [...notable]
    .filter((row) => relGap(row) > 0)
    .sort((a, b) => relGap(b) - relGap(a))[0];
  const hiddenClaim = [...notable]
    .filter((row) => relGap(row) < 0)
    .sort((a, b) => relGap(a) - relGap(b))[0];

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        You, and how others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
        The &ldquo;others&rdquo; column is the equal-weight average of{" "}
        {aggregate.observerCount} anonymous reads — each person counts once, no
        matter how many words they picked. The gap is where growth lives.
      </p>

      {/* Legend */}
      <div className="mt-8 flex items-center gap-6 text-[12px] text-muted">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-6 rounded-full bg-ink" />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-6 rounded-full border border-ink/40 bg-ink/25" />
          Others
        </span>
      </div>

      {/* Divergence highlights */}
      {(blindSpot || hiddenClaim) && (
        <section className="mt-10 grid gap-4 sm:grid-cols-2">
          {blindSpot && (
            <DivergenceCard
              label="Others see more"
              row={blindSpot}
              note="They read this in you more strongly than you claimed it."
            />
          )}
          {hiddenClaim && (
            <DivergenceCard
              label="You claim more"
              row={hiddenClaim}
              note="You rate this above how the people around you read it."
            />
          )}
        </section>
      )}

      {/* Side-by-side bars for all twelve tribes. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Self vs. others, tribe by tribe
        </p>
        <ul className="mt-7 flex flex-col gap-6">
          {rows.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            const diverges = Math.abs(relGap(row)) >= DIVERGENCE_HIGHLIGHT;
            return (
              <li
                key={row.slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <div className="flex flex-col gap-1">
                  <span
                    className="font-serif text-[17px] leading-tight"
                    style={{ color: diverges ? accent : undefined }}
                  >
                    {row.name}
                  </span>
                  {diverges && (
                    <span className="text-[10px] uppercase tracking-[0.12em] text-faint">
                      {relGap(row) > 0 ? "others see more" : "you claim more"}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <CompareBar
                    label="You"
                    relative={row.selfRelative}
                    score={row.self}
                    accent={accent}
                    variant="self"
                  />
                  <CompareBar
                    label="Others"
                    relative={row.othersRelative}
                    score={row.others}
                    accent={accent}
                    variant="others"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-16 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each read, anonymously
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          The individual reads that make up the average — no names, and in no
          order that says who answered when.
        </p>
        <ol className="mt-7 flex flex-col gap-6">
          {aggregate.perObserver.map((profile, index) => {
            const top = rankScores(profile)
              .filter((t) => t.score > 0)
              .slice(0, 3);
            return (
              <li
                key={index}
                className="rounded-[2px] border border-hair p-5"
              >
                <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
                  Observer {index + 1}
                </div>
                {top.length === 0 ? (
                  <p className="mt-3 text-[14px] text-muted">
                    No clear signal from this read.
                  </p>
                ) : (
                  <ul className="mt-4 flex flex-col gap-2.5">
                    {top.map((t) => {
                      const tribe = getTribeBySlug(t.slug);
                      const accent = accentHex(tribe?.color ?? "");
                      return (
                        <li
                          key={t.slug}
                          className="grid grid-cols-[108px_1fr] items-center gap-3 max-[520px]:grid-cols-[88px_1fr]"
                        >
                          <span className="font-serif text-[15px]">
                            {t.name}
                          </span>
                          <div
                            className="h-2 overflow-hidden rounded-full bg-hair/50"
                            role="img"
                            aria-label={`${t.name}: ${Math.round(t.relative * 100)}% of this observer's top tribe`}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.max(t.relative * 100, 4)}%`,
                                backgroundColor: accent,
                                opacity: 0.8,
                              }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function CompareBar({
  label,
  relative,
  score,
  accent,
  variant,
}: {
  label: string;
  relative: number;
  score: number;
  accent: string;
  variant: "self" | "others";
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-[52px] shrink-0 text-[10px] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${Math.round(relative * 100)}% of the top score`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(relative * 100, score > 0 ? 3 : 0)}%`,
            backgroundColor: accent,
            opacity: variant === "self" ? 1 : 0.4,
          }}
        />
      </div>
    </div>
  );
}

function DivergenceCard({
  label,
  row,
  note,
}: {
  label: string;
  row: ComparisonRow;
  note: string;
}) {
  const tribe = getTribeBySlug(row.slug);
  const accent = accentHex(tribe?.color ?? "");
  return (
    <div className="rounded-[2px] border border-hair p-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
        {label}
      </div>
      <div
        className="mt-2 font-serif text-[22px] font-semibold"
        style={{ color: accent }}
      >
        {row.name}
      </div>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">{note}</p>
    </div>
  );
}
