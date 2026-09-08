import { accentHex, getTribeBySlug } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";

/**
 * The self-vs-others 360 comparison report (issue #9, ADR-0003). Presentational
 * and server-safe: it takes already-scored profiles (the Subject's own
 * normalized scores and the equal-weight "others" average) plus each observer's
 * individual profile, and draws the comparison. All scoring happens upstream on
 * the server (the scoring core is `server-only`); this component only reads the
 * client-safe tribe metadata, so `TribeScore` is imported type-only.
 *
 * It shows, for every tribe, the Subject's read beside the aggregated "others"
 * read on one shared scale, calls out where the two most agree and most diverge,
 * and offers an anonymous per-observer drill-down (Observer 1 / 2 / 3 …, no
 * identity) via native `<details>` so no client JavaScript is needed.
 */

export interface ComparisonReportProps {
  /** The Subject's own normalized profile, canonical order. */
  self: readonly TribeScore[];
  /** The equal-weight "others" average, canonical order. */
  others: readonly TribeScore[];
  /** Each observer's individual normalized profile, in stable order. */
  perObserver: readonly (readonly TribeScore[])[];
  /** The Subject's headline Primary slug, highlighted in their column. */
  selfPrimarySlug: string;
  /** The Subject's Secondary slug, if any. */
  selfSecondarySlug?: string | null;
}

/** A tribe paired with the Subject's and others' score for it. */
interface ComparedTribe {
  slug: string;
  name: string;
  selfScore: number;
  othersScore: number;
  /** others − self: positive ⇒ others see it more strongly than the Subject. */
  gap: number;
}

/** Bar width (percent) for a score on a scale where `max` fills the bar. */
function barWidth(score: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max((score / max) * 100, score > 0 ? 2 : 0);
}

export function ComparisonReport({
  self,
  others,
  perObserver,
  selfPrimarySlug,
  selfSecondarySlug,
}: ComparisonReportProps) {
  const othersBySlug = new Map(others.map((t) => [t.slug, t.score]));

  const compared: ComparedTribe[] = self.map((t) => {
    const othersScore = othersBySlug.get(t.slug) ?? 0;
    return {
      slug: t.slug,
      name: t.name,
      selfScore: t.score,
      othersScore,
      gap: othersScore - t.score,
    };
  });

  // Shared scale so the two columns are directly comparable and the chart stays
  // readable even when absolute normalized scores are small.
  const scaleMax = Math.max(
    0,
    ...compared.map((t) => Math.max(t.selfScore, t.othersScore)),
  );

  // Order by the stronger of the two reads so the most relevant tribes lead;
  // ties keep canonical (input) order for determinism.
  const ranked = [...compared].sort(
    (a, b) =>
      Math.max(b.selfScore, b.othersScore) - Math.max(a.selfScore, a.othersScore),
  );

  // Strongest agreement: highest floor across the two reads (both see it).
  const agreement = [...compared]
    .filter((t) => Math.min(t.selfScore, t.othersScore) > 0)
    .sort(
      (a, b) =>
        Math.min(b.selfScore, b.othersScore) - Math.min(a.selfScore, a.othersScore),
    )[0];

  // Largest divergences by absolute gap, keeping only meaningful ones.
  const divergences = [...compared]
    .filter((t) => Math.abs(t.gap) > 0.01)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 3);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        How others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Your own read sits beside the combined read of{" "}
        {perObserver.length} {perObserver.length === 1 ? "person" : "people"} who
        answered anonymously. Each observer counts equally, however many words
        they chose. The gap between the two columns is where growth lives.
      </p>

      {/* Legend for the two columns. */}
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
            style={{ backgroundColor: accentHex("gold") }}
          />
          Others
        </span>
      </div>

      {/* Side-by-side bars, all twelve tribes. */}
      <section className="mt-8 border-t border-hair pt-8">
        <ul className="flex flex-col gap-5">
          {ranked.map((t) => {
            const tribe = getTribeBySlug(t.slug);
            const accent = accentHex(tribe?.color ?? "");
            const role =
              t.slug === selfPrimarySlug
                ? "Primary"
                : t.slug === selfSecondarySlug
                  ? "Secondary"
                  : null;
            return (
              <li
                key={t.slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className="font-serif text-[17px] leading-none"
                    style={{ color: role ? accent : undefined }}
                  >
                    {t.name}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <ComparisonBar
                    label="You"
                    score={t.selfScore}
                    max={scaleMax}
                    color="var(--ink)"
                    tribeName={t.name}
                  />
                  <ComparisonBar
                    label="Others"
                    score={t.othersScore}
                    max={scaleMax}
                    color={accent}
                    tribeName={t.name}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Alignment + divergence callouts. */}
      <section className="mt-14 grid gap-6 border-t border-hair pt-8 sm:grid-cols-2">
        <div>
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where you agree
          </p>
          {agreement ? (
            <p className="mt-3 text-[15px] leading-relaxed text-ink">
              You and your observers both read{" "}
              <strong className="font-semibold">{agreement.name}</strong>{" "}
              strongly — the clearest shared note in how you show up.
            </p>
          ) : (
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              No single tribe stands out as a shared strong read yet.
            </p>
          )}
        </div>
        <div>
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where others see you differently
          </p>
          {divergences.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-2 text-[15px] leading-relaxed text-ink">
              {divergences.map((t) => (
                <li key={t.slug}>
                  <strong className="font-semibold">{t.name}</strong> —{" "}
                  {t.gap > 0
                    ? "others see this in you more than you do."
                    : "you claim this more than others see it."}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              Your read and theirs line up closely across the board.
            </p>
          )}
        </div>
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Each observer&rsquo;s own read, fully anonymous — there&rsquo;s no way
          to tell who is who.
        </p>
        <div className="mt-5 flex flex-col gap-2.5">
          {perObserver.map((profile, i) => (
            <ObserverDetail key={i} index={i} profile={profile} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ComparisonBar({
  label,
  score,
  max,
  color,
  tribeName,
}: {
  label: string;
  score: number;
  max: number;
  color: string;
  tribeName: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-[52px] shrink-0 text-[10px] uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label} read of ${tribeName}: ${Math.round(score * 100)} out of 100`}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${barWidth(score, max)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

/** One anonymous observer's top tribes, collapsed behind a `<details>`. */
function ObserverDetail({
  index,
  profile,
}: {
  index: number;
  profile: readonly TribeScore[];
}) {
  const top = [...profile]
    .sort((a, b) => b.score - a.score)
    .filter((t) => t.score > 0)
    .slice(0, 3);

  return (
    <details className="rounded-[2px] border border-hair bg-white/40 px-4 py-3">
      <summary className="cursor-pointer text-[14px] text-ink marker:text-faint">
        Observer {index + 1}
      </summary>
      {top.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {top.map((t) => {
            const tribe = getTribeBySlug(t.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li
                key={t.slug}
                className="rounded-[2px] border px-3 py-1 text-[13px]"
                style={{ borderColor: accent, color: accent }}
              >
                {t.name}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-[13px] text-muted">
          This observer&rsquo;s selection didn&rsquo;t point to any tribe.
        </p>
      )}
    </details>
  );
}
