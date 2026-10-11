import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { rankScores } from "@/lib/assessment/ranking";
import type { TribeScore } from "@/lib/assessment/score";

/**
 * The 360 comparison report (issue #9): the Subject's own profile set beside the
 * equal-weight "others" profile, with the tribes where the two views align or
 * diverge called out, and an anonymous per-observer drill-down.
 *
 * Purely presentational — it receives already-computed, normalized scores
 * (slug + score only) and never touches the word→tribe mapping or the scoring
 * core, so it stays on the safe side of the ADR-0009 trust boundary. The
 * per-observer rows are labelled only "Observer 1 / 2 / …" with no attributes,
 * preserving anonymity (ADR-0003). It renders as a server component; the
 * drill-down uses native <details> so no client JS is needed.
 */

/** A tribe lined up across both profiles, with the signed gap (others − self). */
interface ComparisonRow {
  slug: string;
  name: string;
  self: number;
  others: number;
  /** others − self: positive means others see more of this tribe than you do. */
  gap: number;
}

function buildRows(self: TribeScore[], others: TribeScore[]): ComparisonRow[] {
  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));
  const rows = self.map((s) => {
    const othersScore = othersBySlug.get(s.slug) ?? 0;
    return {
      slug: s.slug,
      name: s.name,
      self: s.score,
      others: othersScore,
      gap: othersScore - s.score,
    };
  });
  // Most salient tribes first — the higher of the two views — so a tribe others
  // rate highly still surfaces near the top even when the Subject doesn't.
  // Ties keep canonical order (the input is already canonical), so it's stable.
  return rows.sort((a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others));
}

function pct(score: number, max: number): number {
  return max > 0 ? (score / max) * 100 : 0;
}

export function ComparisonReport({
  self,
  others,
  perObserver,
}: {
  self: TribeScore[];
  others: TribeScore[];
  perObserver: TribeScore[][];
}) {
  const rows = buildRows(self, others);

  // Shared scale across both profiles so the two bars are directly comparable.
  const max = Math.max(...rows.map((r) => Math.max(r.self, r.others)), 0);

  // The sharpest disagreements, largest absolute gap first.
  const divergences = [...rows]
    .filter((r) => Math.abs(r.gap) > 0.001)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 2);

  // Strongest shared read: both views high and close together.
  const alignment = [...rows]
    .filter((r) => Math.min(r.self, r.others) > 0)
    .sort(
      (a, b) =>
        Math.min(b.self, b.others) -
        Math.abs(b.gap) -
        (Math.min(a.self, a.others) - Math.abs(a.gap)),
    )[0];

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        How others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[16px] leading-relaxed text-muted">
        Your own profile is set beside the combined read from{" "}
        {perObserver.length}{" "}
        {perObserver.length === 1 ? "observer" : "observers"}. Each observer
        counts equally, so no single voice — or anyone who simply picked more
        words — outweighs the rest.
      </p>

      {/* Legend for the two bars. */}
      <div className="mt-8 flex items-center gap-6 text-[12px] uppercase tracking-[0.14em] text-faint">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-ink" aria-hidden />
          You
        </span>
        <span className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full border border-ink/40 bg-ink/25"
            aria-hidden
          />
          Others
        </span>
      </div>

      {/* Side-by-side bars for all twelve tribes on a shared scale. */}
      <section className="mt-6">
        <ul className="flex flex-col gap-5">
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
                  <Bar
                    widthPct={pct(row.self, max)}
                    color={accent}
                    solid
                    label={`You see ${row.name}: ${Math.round(row.self * 100)} out of 100`}
                  />
                  <Bar
                    widthPct={pct(row.others, max)}
                    color={accent}
                    solid={false}
                    label={`Others see ${row.name}: ${Math.round(row.others * 100)} out of 100`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Where the two views meet and where they part. */}
      <section className="mt-16 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Where the views meet and part
        </p>
        <div className="mt-6 flex flex-col gap-5">
          {alignment && (
            <p className="text-[16px] leading-relaxed text-ink">
              <span className="font-serif text-gold">Common ground.</span> You
              and your observers both read{" "}
              <TribeName slug={alignment.slug} name={alignment.name} /> strongly,
              and see it to much the same degree.
            </p>
          )}
          {divergences.map((row) => (
            <p
              key={row.slug}
              className="text-[16px] leading-relaxed text-ink"
            >
              <span className="font-serif text-gold">Blind spot.</span>{" "}
              {row.gap > 0 ? (
                <>
                  Others see more{" "}
                  <TribeName slug={row.slug} name={row.name} /> in you than you
                  see in yourself.
                </>
              ) : (
                <>
                  You see more{" "}
                  <TribeName slug={row.slug} name={row.name} /> in yourself than
                  others do.
                </>
              )}
            </p>
          ))}
        </div>
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-16 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          Each observer&rsquo;s individual read, fully anonymous. Expand one to
          see how that single perspective ranked the tribes.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          {perObserver.map((scores, i) => (
            <ObserverDetail key={i} index={i} scores={scores} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Bar({
  widthPct,
  color,
  solid,
  label,
}: {
  widthPct: number;
  color: string;
  solid: boolean;
  label: string;
}) {
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${Math.max(widthPct, widthPct > 0 ? 3 : 0)}%`,
          backgroundColor: color,
          opacity: solid ? 1 : 0.4,
        }}
      />
    </div>
  );
}

function TribeName({ slug, name }: { slug: string; name: string }) {
  const accent = accentHex(getTribeBySlug(slug)?.color ?? "");
  return (
    <span className="font-serif" style={{ color: accent }}>
      {name}
    </span>
  );
}

function ObserverDetail({
  index,
  scores,
}: {
  index: number;
  scores: TribeScore[];
}) {
  const ranked = rankScores(scores).filter((r) => r.score > 0).slice(0, 5);
  return (
    <details className="group rounded-[2px] border border-hair">
      <summary className="flex cursor-pointer items-center justify-between px-5 py-3.5 text-[14px] tracking-[0.04em] text-ink marker:content-['']">
        <span className="uppercase tracking-[0.16em] text-faint">
          Observer {index + 1}
        </span>
        <span className="text-[12px] text-muted transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="border-t border-hair px-5 py-4">
        {ranked.length === 0 ? (
          <p className="text-[14px] text-muted">
            No tribe stood out from this observer&rsquo;s selection.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {ranked.map((row) => {
              const accent = accentHex(getTribeBySlug(row.slug)?.color ?? "");
              return (
                <li
                  key={row.slug}
                  className="grid grid-cols-[110px_1fr] items-center gap-4 max-[520px]:grid-cols-[88px_1fr]"
                >
                  <span className="text-[14px] text-ink">{row.name}</span>
                  <Bar
                    widthPct={row.relative * 100}
                    color={accent}
                    solid
                    label={`${row.name}: ${Math.round(row.relative * 100)}% of this observer's top read`}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}
