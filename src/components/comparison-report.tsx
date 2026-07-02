import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { rankScores } from "@/lib/assessment/ranking";
import type { TribeScore } from "@/lib/assessment/score";
import { compareProfiles } from "@/lib/assessment/aggregateObservers";

/**
 * The 360 comparison report (issue #9): the Subject's own profile shown beside
 * the equal-weight aggregated "others" profile, the tribes where the two views
 * align and diverge, and an anonymous per-observer drill-down.
 *
 * Server component. It receives already-computed `TribeScore` arrays (scoring
 * happens server-side in the page), so the word→tribe mapping never reaches the
 * client. The drill-down uses native `<details>` so no client JavaScript is
 * needed. Render only from the report page, which gates it behind the ≥3
 * observer unlock (ADR-0003).
 */
export function ComparisonReport({
  self,
  others,
  perObserver,
}: {
  self: TribeScore[];
  others: TribeScore[];
  perObserver: TribeScore[][];
}) {
  const comparison = compareProfiles(self, others);
  const sharedMax = Math.max(
    ...comparison.map((row) => Math.max(row.self, row.others)),
    0,
  );

  // Draw the twelve tribes most-prominent first (by the higher of the two
  // views), so the report opens on the tribes that actually carry signal.
  const byProminence = [...comparison].sort(
    (a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others),
  );

  // Divergences: where self and others disagree most (largest |delta|). Only
  // tribes at least one view scored are worth calling out.
  const scored = comparison.filter((row) => row.self > 0 || row.others > 0);
  const divergences = [...scored]
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .filter((row) => Math.abs(row.delta) > 0.001)
    .slice(0, 3);
  // Alignment: where both views land closest together (smallest |delta|).
  const alignments = [...scored]
    .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))
    .slice(0, 2);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Self vs. 360
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,54px)] font-semibold leading-[1.04]">
        How others see you
      </h1>
      <p className="mt-4 max-w-[540px] text-[16px] leading-relaxed text-muted">
        Your own profile beside the combined read from{" "}
        {perObserver.length} people who described you. Each observer counts
        equally — how many words they picked doesn&rsquo;t change their weight.
      </p>

      {/* Legend for the two series. */}
      <div className="mt-8 flex items-center gap-6 text-[12px] uppercase tracking-[0.14em] text-muted">
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-6 rounded-full"
            style={{ backgroundColor: "var(--ink)" }}
          />
          You
        </span>
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-6 rounded-full"
            style={{ backgroundColor: "var(--gold)" }}
          />
          Others
        </span>
      </div>

      {/* Side-by-side bars for all twelve tribes. */}
      <section className="mt-8">
        <ul className="flex flex-col gap-5">
          {byProminence.map((row) => (
            <li
              key={row.slug}
              className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
            >
              <span className="font-serif text-[17px] leading-tight">
                {row.name}
              </span>
              <div className="flex flex-col gap-1.5">
                <CompareBar
                  value={row.self}
                  sharedMax={sharedMax}
                  color="var(--ink)"
                  label={`You: ${pct(row.self)}`}
                />
                <CompareBar
                  value={row.others}
                  sharedMax={sharedMax}
                  color="var(--gold)"
                  label={`Others: ${pct(row.others)}`}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Where the two views diverge and align. */}
      {(divergences.length > 0 || alignments.length > 0) && (
        <section className="mt-16 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where you diverge
          </p>
          {divergences.length > 0 ? (
            <ul className="mt-5 flex flex-col gap-3">
              {divergences.map((row) => (
                <li key={row.slug} className="text-[16px] leading-relaxed text-ink">
                  {row.delta > 0 ? (
                    <>
                      You see more{" "}
                      <span className="font-serif text-gold">{row.name}</span> in
                      yourself than others do.
                    </>
                  ) : (
                    <>
                      Others see more{" "}
                      <span className="font-serif text-gold">{row.name}</span> in
                      you than you see in yourself.
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 text-[16px] text-muted">
              Your self-read and the 360 line up closely across the board.
            </p>
          )}

          {alignments.length > 0 && (
            <>
              <p className="mt-8 text-[12px] uppercase tracking-[0.2em] text-faint">
                Where you agree
              </p>
              <p className="mt-4 text-[16px] leading-relaxed text-ink">
                You and the people who know you read{" "}
                {alignments.map((row, i) => (
                  <span key={row.slug}>
                    <span className="font-serif text-gold">{row.name}</span>
                    {i < alignments.length - 1 ? " and " : ""}
                  </span>
                ))}{" "}
                about the same.
              </p>
            </>
          )}
        </section>
      )}

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-16 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each observer
        </p>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          The spread of opinion, one respondent at a time — fully anonymous, in no
          particular order.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          {perObserver.map((profile, index) => (
            <details
              key={index}
              className="rounded-[2px] border border-hair px-5 py-4"
            >
              <summary className="cursor-pointer list-none font-serif text-[18px] text-ink marker:content-none">
                Observer {index + 1}
              </summary>
              <ObserverBars profile={profile} />
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

/** A single labelled bar scaled against the report's shared maximum. */
function CompareBar({
  value,
  sharedMax,
  color,
  label,
}: {
  value: number;
  sharedMax: number;
  color: string;
  label: string;
}) {
  const width = sharedMax > 0 ? (value / sharedMax) * 100 : 0;
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={label}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.max(width, value > 0 ? 3 : 0)}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

/** One anonymous observer's ranked profile, drawn in each tribe's accent. */
function ObserverBars({ profile }: { profile: TribeScore[] }) {
  const ranked = rankScores(profile);
  return (
    <ul className="mt-4 flex flex-col gap-2.5">
      {ranked.map((row) => {
        const tribe = getTribeBySlug(row.slug);
        const accent = accentHex(tribe?.color ?? "");
        return (
          <li
            key={row.slug}
            className="grid grid-cols-[110px_1fr] items-center gap-3 max-[520px]:grid-cols-[88px_1fr]"
          >
            <span className="text-[14px] text-muted">{row.name}</span>
            <div
              className="h-2 overflow-hidden rounded-full bg-hair/50"
              role="img"
              aria-label={`${row.name}: ${Math.round(row.relative * 100)}% of this observer's top score`}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(row.relative * 100, row.score > 0 ? 3 : 0)}%`,
                  backgroundColor: accent,
                  opacity: 0.75,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Format a normalized 0–1 score as a whole-number percentage for a11y labels. */
function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}
