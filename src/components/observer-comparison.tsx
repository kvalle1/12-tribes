import { accentHex, getTribeBySlug } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";

/**
 * The 360 comparison report body (issue #9): the Subject's own profile laid
 * beside the equal-weight "others" profile, tribe by tribe, plus an anonymous
 * per-observer drill-down. It renders from already-computed `TribeScore[]`
 * arrays (slug/name/score) — the word→tribe mapping and the scoring core stay on
 * the server (ADR-0009); this component only draws bars.
 *
 * Self and others bars share one denominator (the top score across both
 * profiles) so their lengths are directly comparable — the whole point is to see
 * where the two readings align and where they diverge.
 */
export function ObserverComparison({
  self,
  others,
  perObserver,
}: {
  self: TribeScore[];
  others: TribeScore[];
  perObserver: TribeScore[][];
}) {
  const selfBySlug = new Map(self.map((s) => [s.slug, s.score]));
  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));

  // One shared scale so a "You" bar and an "Others" bar of the same length mean
  // the same score.
  const sharedMax = Math.max(
    0,
    ...self.map((s) => s.score),
    ...others.map((s) => s.score),
  );

  // Rank by the stronger of the two readings so prominent tribes on either side
  // rise to the top; ties keep canonical (tribe `number`) order via a stable sort.
  const rows = self
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      self: s.score,
      others: othersBySlug.get(s.slug) ?? 0,
    }))
    .sort((a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others));

  const divergence = computeDivergence(self, selfBySlug, othersBySlug);

  return (
    <div>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] uppercase tracking-[0.14em] text-faint">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full bg-ink" />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full border border-ink/40 bg-ink/20" />
          Others ({perObserver.length})
        </span>
      </div>

      {/* Paired bars, tribe by tribe. */}
      <ul className="mt-6 flex flex-col gap-4">
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
                  label={`You: ${pct(row.self)}`}
                  fraction={frac(row.self, sharedMax)}
                  color={accent}
                  filled
                />
                <Bar
                  label={`Others: ${pct(row.others)}`}
                  fraction={frac(row.others, sharedMax)}
                  color={accent}
                  filled={false}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Where the two readings align and where they diverge. */}
      {divergence && (
        <section className="mt-14 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where the readings meet — and part
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <InsightCard
              heading="Strongest agreement"
              body={
                <>
                  You and the room both land on{" "}
                  <Emph slug={divergence.aligned.slug}>
                    {divergence.aligned.name}
                  </Emph>
                  .
                </>
              }
            />
            {divergence.othersHigher && (
              <InsightCard
                heading="Others see more than you claim"
                body={
                  <>
                    The room reads{" "}
                    <Emph slug={divergence.othersHigher.slug}>
                      {divergence.othersHigher.name}
                    </Emph>{" "}
                    in you more strongly than you do.
                  </>
                }
              />
            )}
            {divergence.selfHigher && (
              <InsightCard
                heading="You claim more than others see"
                body={
                  <>
                    You lean into{" "}
                    <Emph slug={divergence.selfHigher.slug}>
                      {divergence.selfHigher.name}
                    </Emph>{" "}
                    more than the room sees in you.
                  </>
                }
              />
            )}
          </div>
        </section>
      )}

      {/* Anonymous per-observer drill-down — the spread of opinion, no identities. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          The spread of opinion
        </p>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          Each response, anonymised. No names, no relationships — just the top
          tribes each person saw in you.
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {perObserver.map((profile, i) => (
            <ObserverCard key={i} index={i + 1} profile={profile} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function Bar({
  label,
  fraction,
  color,
  filled,
}: {
  label: string;
  fraction: number;
  color: string;
  filled: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={label}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(fraction * 100, fraction > 0 ? 3 : 0)}%`,
            backgroundColor: color,
            opacity: filled ? 1 : 0.4,
          }}
        />
      </div>
      <span className="w-[92px] shrink-0 text-right text-[11px] tracking-[0.06em] text-faint">
        {label}
      </span>
    </div>
  );
}

function ObserverCard({
  index,
  profile,
}: {
  index: number;
  profile: TribeScore[];
}) {
  const top = [...profile]
    .sort((a, b) => b.score - a.score)
    .filter((s) => s.score > 0)
    .slice(0, 3);
  const max = top.length > 0 ? top[0].score : 0;

  return (
    <li className="rounded-[2px] border border-hair p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
        Observer {index}
      </div>
      {top.length === 0 ? (
        <p className="mt-2 text-[14px] text-muted">No clear read.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {top.map((s) => {
            const tribe = getTribeBySlug(s.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li key={s.slug} className="grid grid-cols-[88px_1fr] items-center gap-3">
                <span
                  className="font-serif text-[15px] leading-tight"
                  style={{ color: accent }}
                >
                  {s.name}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-hair/50">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max((max > 0 ? s.score / max : 0) * 100, 3)}%`,
                      backgroundColor: accent,
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
}

function InsightCard({
  heading,
  body,
}: {
  heading: string;
  body: React.ReactNode;
}) {
  return (
    <div className="rounded-[2px] border border-hair p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
        {heading}
      </div>
      <p className="mt-2 text-[15px] leading-snug text-ink">{body}</p>
    </div>
  );
}

function Emph({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const tribe = getTribeBySlug(slug);
  return (
    <span
      className="font-serif italic"
      style={{ color: accentHex(tribe?.color ?? "") }}
    >
      {children}
    </span>
  );
}

const pct = (score: number) => `${Math.round(score * 100)}%`;
const frac = (score: number, max: number) => (max > 0 ? score / max : 0);

/**
 * Pick out the tribe the two readings most agree on and the two tribes where
 * they most diverge (others-higher and self-higher). Only tribes that register
 * on at least one side are considered, so an all-zero pair yields nothing.
 */
function computeDivergence(
  self: TribeScore[],
  selfBySlug: Map<string, number>,
  othersBySlug: Map<string, number>,
) {
  const rows = self
    .map((s) => {
      const selfScore = selfBySlug.get(s.slug) ?? 0;
      const othersScore = othersBySlug.get(s.slug) ?? 0;
      return {
        slug: s.slug,
        name: s.name,
        self: selfScore,
        others: othersScore,
        diff: othersScore - selfScore,
        combined: selfScore + othersScore,
      };
    })
    .filter((r) => r.combined > 0);

  if (rows.length === 0) return null;

  // Strongest agreement: prominent on both sides with the smallest gap.
  const aligned = [...rows].sort(
    (a, b) => Math.abs(a.diff) - Math.abs(b.diff) || b.combined - a.combined,
  )[0];

  const othersHigherRow = [...rows].sort((a, b) => b.diff - a.diff)[0];
  const selfHigherRow = [...rows].sort((a, b) => a.diff - b.diff)[0];

  return {
    aligned,
    othersHigher: othersHigherRow.diff > 0.01 ? othersHigherRow : null,
    selfHigher: selfHigherRow.diff < -0.01 ? selfHigherRow : null,
  };
}
