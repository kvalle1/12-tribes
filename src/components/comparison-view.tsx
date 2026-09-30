import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score, deriveResult } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import { aggregateObservers } from "@/lib/assessment/aggregateObservers";
import type { ObserverResponse } from "@/lib/observer/repository";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * beside the equal-weight "others" profile, so the gap between how they see
 * themselves and how others see them is legible. Below the paired view, an
 * anonymous per-observer drill-down (Observer 1 / 2 / 3 …) shows the spread
 * without ever identifying anyone.
 *
 * A server component: it imports the `server-only` scoring core and
 * `aggregateObservers`, so the word→tribe mapping never reaches the client
 * (ADR-0009). Render it only from server components. The caller is responsible
 * for the ≥3-observer unlock gate; this view assumes it has enough responses to
 * show.
 */
export function ComparisonView({
  subjectWords,
  responses,
}: {
  subjectWords: string[];
  responses: ObserverResponse[];
}) {
  const self = score(subjectWords);
  const others = aggregateObservers(responses.map((r) => r.words));

  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));

  // Order tribes by combined salience (self + others), so the tribes that matter
  // most to either view surface first. Both inputs are already in canonical order,
  // so the stable sort keeps canonical order for ties.
  const rows = self
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      selfScore: s.score,
      othersScore: othersBySlug.get(s.slug) ?? 0,
    }))
    .sort((a, b) => b.selfScore + b.othersScore - (a.selfScore + a.othersScore));

  // Shared scale across both profiles so the two bars are directly comparable.
  const scaleMax = Math.max(
    1e-9,
    ...rows.map((r) => Math.max(r.selfScore, r.othersScore)),
  );

  const selfPrimary = deriveResult(self).primary;
  const othersPrimary = rankScores(others)[0];
  const agree = selfPrimary.slug === othersPrimary.slug;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Self vs the room
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,52px)] font-semibold leading-[1.05]">
        How others see you
      </h1>
      <p className="mt-4 max-w-[540px] text-[15px] leading-relaxed text-muted">
        {agree ? (
          <>
            You and the people who described you land on the same Primary —{" "}
            <span className="text-ink">{selfPrimary.name}</span>. The bars below
            show where the rest of the read aligns and where it drifts.
          </>
        ) : (
          <>
            You see yourself as{" "}
            <span className="text-ink">{selfPrimary.name}</span>, while the room
            most sees <span className="text-ink">{othersPrimary.name}</span>.
            That gap is where the most useful insight tends to live.
          </>
        )}
      </p>

      {/* Legend */}
      <div className="mt-8 flex items-center gap-6 text-[11px] uppercase tracking-[0.14em] text-faint">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-6 rounded-full bg-ink" />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-6 rounded-full bg-ink/25" />
          Others
        </span>
      </div>

      {/* Paired bars — self against the equal-weight others profile. */}
      <section className="mt-6 border-t border-hair pt-8">
        <ul className="flex flex-col gap-6">
          {rows.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li
                key={row.slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <span
                  className="font-serif text-[17px] leading-tight"
                  style={{ color: accent }}
                >
                  {row.name}
                </span>
                <div className="flex flex-col gap-1.5">
                  <Bar
                    label="You"
                    fraction={row.selfScore / scaleMax}
                    hasScore={row.selfScore > 0}
                    color={accent}
                    opacity={1}
                    tribeName={row.name}
                  />
                  <Bar
                    label="Others"
                    fraction={row.othersScore / scaleMax}
                    hasScore={row.othersScore > 0}
                    color={accent}
                    opacity={0.4}
                    tribeName={row.name}
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
          The room, one by one
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Each response, kept fully anonymous — no names, no relationships, just
          the top tribes each person picked for you.
        </p>
        <ol className="mt-6 flex flex-col gap-6">
          {responses.map((response, index) => {
            const ranked = rankScores(score(response.words)).filter(
              (r) => r.score > 0,
            );
            const top = ranked.slice(0, 3);
            return (
              <li key={index} className="border-t border-hair/60 pt-5 first:border-t-0 first:pt-0">
                <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
                  Observer {index + 1}
                </p>
                <ul className="mt-3 flex flex-col gap-2">
                  {top.map((r) => {
                    const tribe = getTribeBySlug(r.slug);
                    const accent = accentHex(tribe?.color ?? "");
                    return (
                      <li
                        key={r.slug}
                        className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
                      >
                        <span className="font-serif text-[15px]">{r.name}</span>
                        <div
                          className="h-2 flex-1 overflow-hidden rounded-full bg-hair/50"
                          role="img"
                          aria-label={`Observer ${index + 1} — ${r.name}: ${Math.round(r.relative * 100)}% of their top pick`}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(r.relative * 100, 3)}%`,
                              backgroundColor: accent,
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function Bar({
  label,
  fraction,
  hasScore,
  color,
  opacity,
  tribeName,
}: {
  label: string;
  fraction: number;
  hasScore: boolean;
  color: string;
  opacity: number;
  tribeName: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-[46px] shrink-0 text-[10px] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label} — ${tribeName}: ${Math.round(fraction * 100)}% of the strongest score`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(fraction * 100, hasScore ? 3 : 0)}%`,
            backgroundColor: color,
            opacity,
          }}
        />
      </div>
    </div>
  );
}
