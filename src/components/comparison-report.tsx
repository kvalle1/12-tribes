import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import { aggregateObservers } from "@/lib/assessment/aggregateObservers";
import {
  ObserverDrilldown,
  type ObserverRead,
} from "@/components/observer-drilldown";

/**
 * The 360 self-vs-others comparison report (issue #9). Renders the Subject's own
 * Strength Profile alongside the equal-weight aggregated "others" profile, calls
 * out where the two most align and diverge, and offers an anonymous per-observer
 * drill-down.
 *
 * A server component: it imports the `server-only` scoring core and aggregation,
 * scores everything here, and hands the client drill-down only plain, resolved
 * display values — no words, no word→tribe mapping, no observer identity ever
 * cross the boundary (ADR-0009, ADR-0003). Render it only from a server
 * component, and only once at least three Observers have responded (the caller
 * gates that; below the threshold individual Observers wouldn't stay anonymous).
 */
export function ComparisonReport({
  selfWords,
  primarySlug,
  secondarySlug,
  observerWordLists,
}: {
  selfWords: string[];
  primarySlug: string;
  secondarySlug?: string | null;
  observerWordLists: string[][];
}) {
  const selfScores = score(selfWords);
  const othersScores = aggregateObservers(observerWordLists);
  const othersBySlug = new Map(othersScores.map((s) => [s.slug, s.score]));

  // One merged row per tribe. Sort by the louder of the two voices so the tribes
  // either party rates highly rise to the top, keeping divergences visible; ties
  // keep canonical (tribe `number`) order via the stable sort of `selfScores`.
  const rows = selfScores
    .map((self) => ({
      slug: self.slug,
      name: self.name,
      self: self.score,
      others: othersBySlug.get(self.slug) ?? 0,
    }))
    .sort((a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others));

  const sharedMax = Math.max(
    ...rows.map((r) => Math.max(r.self, r.others)),
    0,
  );

  const othersTop = rankScores(othersScores)[0];
  const selfPrimary = getTribeBySlug(primarySlug);

  const divergences = divergenceHighlights(rows);

  const observerReads: ObserverRead[] = observerWordLists.map((words) => ({
    top: rankScores(score(words))
      .filter((t) => t.score > 0)
      .slice(0, 6)
      .map((t) => ({
        slug: t.slug,
        name: t.name,
        accent: accentHex(getTribeBySlug(t.slug)?.color ?? ""),
        relative: t.relative,
      })),
  }));

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read · {observerWordLists.length} people
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,54px)] font-semibold leading-[1.05]">
        How others see you
      </h1>
      <p className="mt-4 max-w-[520px] text-[15px] text-muted">
        Your own read sits beside the combined read of the{" "}
        {observerWordLists.length} people who described you. Each observer is
        weighted equally, so no single voice dominates.
      </p>

      {/* Headline comparison: your Primary vs where others land. */}
      <div className="mt-8 grid grid-cols-2 gap-4 max-[520px]:grid-cols-1">
        <HeadlineCard
          label="You lead with"
          tribeName={selfPrimary?.name ?? primarySlug}
          accent={accentHex(selfPrimary?.color ?? "")}
        />
        <HeadlineCard
          label="Others lead with"
          tribeName={othersTop?.name ?? "—"}
          accent={accentHex(getTribeBySlug(othersTop?.slug ?? "")?.color ?? "")}
        />
      </div>

      {/* Divergence / alignment callouts. */}
      {divergences.length > 0 && (
        <ul className="mt-8 flex flex-col gap-2.5">
          {divergences.map((d) => (
            <li
              key={d.key}
              className="rounded-[2px] border border-hair bg-white/60 px-4 py-3 text-[14px] text-ink"
            >
              <span className="text-[11px] uppercase tracking-[0.14em] text-faint">
                {d.heading}
              </span>
              <div className="mt-1">{d.body}</div>
            </li>
          ))}
        </ul>
      )}

      {/* Side-by-side bars: You vs Others for all twelve tribes. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            You vs others · the twelve
          </p>
          <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.12em] text-faint">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-4 rounded-full bg-ink" /> You
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-4 rounded-full bg-ink/30" />{" "}
              Others
            </span>
          </div>
        </div>

        <ul className="mt-6 flex flex-col gap-4">
          {rows.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            const role =
              row.slug === primarySlug
                ? "Primary"
                : row.slug === secondarySlug
                  ? "Secondary"
                  : null;
            return (
              <li
                key={row.slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <span
                  className="font-serif text-[17px] leading-tight"
                  style={{ color: role ? accent : undefined }}
                >
                  {row.name}
                </span>
                <div className="flex flex-col gap-1.5">
                  <CompareBar
                    label="You"
                    value={row.self}
                    max={sharedMax}
                    accent={accent}
                    strong
                  />
                  <CompareBar
                    label="Others"
                    value={row.others}
                    max={sharedMax}
                    accent={accent}
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
          Each observer&rsquo;s read
        </p>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          The spread of opinion, one anonymous observer at a time. No names, no
          relationships — just how each person read you.
        </p>
        <ObserverDrilldown observers={observerReads} />
      </section>
    </div>
  );
}

function HeadlineCard({
  label,
  tribeName,
  accent,
}: {
  label: string;
  tribeName: string;
  accent: string;
}) {
  return (
    <div className="rounded-[2px] border border-hair p-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
        {label}
      </div>
      <div
        className="mt-2 font-serif text-[26px] font-semibold leading-tight"
        style={{ color: accent }}
      >
        {tribeName}
      </div>
    </div>
  );
}

function CompareBar({
  label,
  value,
  max,
  accent,
  strong = false,
}: {
  label: string;
  value: number;
  max: number;
  accent: string;
  strong?: boolean;
}) {
  const fraction = max > 0 ? value / max : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-11 shrink-0 text-[9px] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${Math.round(fraction * 100)}% of the top score`}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(fraction * 100, value > 0 ? 3 : 0)}%`,
            backgroundColor: accent,
            opacity: strong ? 1 : 0.4,
          }}
        />
      </div>
    </div>
  );
}

interface Highlight {
  key: string;
  heading: string;
  body: string;
}

/**
 * Surface the sharpest alignment and the two sharpest divergences between the
 * Subject's own read and the aggregated "others" read. Divergence is the plain
 * difference of the two normalized scores per tribe; both series are 0–1
 * normalized, so the gap is directly comparable.
 */
function divergenceHighlights(
  rows: { slug: string; name: string; self: number; others: number }[],
): Highlight[] {
  const MEANINGFUL = 0.08;
  const highlights: Highlight[] = [];

  const othersHigher = [...rows].sort(
    (a, b) => b.others - b.self - (a.others - a.self),
  )[0];
  if (othersHigher && othersHigher.others - othersHigher.self > MEANINGFUL) {
    highlights.push({
      key: `others-${othersHigher.slug}`,
      heading: "Others see more of this",
      body: `The people who described you read more ${othersHigher.name} in you than you claimed for yourself.`,
    });
  }

  const selfHigher = [...rows].sort(
    (a, b) => b.self - b.others - (a.self - a.others),
  )[0];
  if (selfHigher && selfHigher.self - selfHigher.others > MEANINGFUL) {
    highlights.push({
      key: `self-${selfHigher.slug}`,
      heading: "You lean in harder here",
      body: `You claimed more ${selfHigher.name} for yourself than the people around you saw.`,
    });
  }

  const aligned = [...rows]
    .filter((r) => r.self > 0 || r.others > 0)
    .sort((a, b) => Math.abs(a.self - a.others) - Math.abs(b.self - b.others))[0];
  if (aligned) {
    highlights.push({
      key: `aligned-${aligned.slug}`,
      heading: "Where you agree",
      body: `You and your observers read ${aligned.name} in you about the same.`,
    });
  }

  return highlights;
}
