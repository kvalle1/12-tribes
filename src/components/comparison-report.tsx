import { accentHex, getTribeBySlug } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * beside the equal-weight "others" profile, with the tribes where the two most
 * agree and most diverge called out, plus an anonymous per-observer drill-down.
 *
 * Presentational and prop-driven — all scoring happens server-side (the scoring
 * core is `server-only`) and only plain score data reaches here, so this stays a
 * thin, mapping-free view (ADR-0009 trust boundary). Observers are passed as
 * bare `{ index, scores }`, never anything that could identify them.
 */

export interface ComparisonObserver {
  index: number;
  scores: TribeScore[];
}

export function ComparisonReport({
  self,
  others,
  observers,
  primarySlug,
  secondarySlug,
}: {
  self: TribeScore[];
  others: TribeScore[];
  observers: ComparisonObserver[];
  primarySlug: string;
  secondarySlug?: string | null;
}) {
  const rows = comparisonRows(self, others);
  const { agreement, divergences } = highlights(rows);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        The gap is where growth lives
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        You vs. how others see you
      </h1>
      <p className="mt-4 max-w-[540px] text-[15px] leading-relaxed text-muted">
        Your own selection sits beside the equal-weight average of{" "}
        {observers.length} anonymous {observers.length === 1 ? "read" : "reads"}.
        Each observer counts once, however many words they chose.
      </p>

      {/* The two most notable takeaways, stated plainly before the full chart. */}
      {(agreement || divergences.length > 0) && (
        <section className="mt-12 grid gap-4 sm:grid-cols-2">
          {agreement && (
            <Callout
              label="Strongest agreement"
              slug={agreement.slug}
              detail={`You and your observers both place ${agreement.name} near the top.`}
            />
          )}
          {divergences[0] && (
            <Callout
              label="Biggest difference"
              slug={divergences[0].slug}
              detail={
                divergences[0].gap > 0
                  ? `Others see more ${divergences[0].name} in you than you do.`
                  : `You see more ${divergences[0].name} in yourself than others do.`
              }
            />
          )}
        </section>
      )}

      {/* Self vs others, tribe by tribe, on one shared scale. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-baseline justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            You vs. others, tribe by tribe
          </p>
          <Legend />
        </div>
        <ul className="mt-7 flex flex-col gap-5">
          {rows.map((row) => (
            <PairBar
              key={row.slug}
              row={row}
              role={
                row.slug === primarySlug
                  ? "Your primary"
                  : row.slug === secondarySlug
                    ? "Your secondary"
                    : null
              }
            />
          ))}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down: Observer 1 / 2 / 3, no attributes. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each observer, anonymously
        </p>
        <p className="mt-2 max-w-[540px] text-[14px] text-muted">
          Every response is fully anonymous — no names, no relationships, just the
          words they chose.
        </p>
        <div className="mt-6 flex flex-col gap-8">
          {observers.map((observer) => (
            <ObserverColumn key={observer.index} observer={observer} />
          ))}
        </div>
      </section>
    </div>
  );
}

/** A tribe row carrying both profiles' own-scaled bar fractions and their gap. */
interface ComparisonRow {
  slug: string;
  name: string;
  /**
   * Each side's prominence within its OWN profile (0–1, relative to that
   * profile's top tribe). The two profiles live on different scales — "you" is
   * one coverage-normalized selection, "others" is a unit-mass average — so they
   * are compared by relative prominence, i.e. shape, not absolute magnitude.
   */
  selfRelative: number;
  othersRelative: number;
  /** othersRelative − selfRelative: positive means others rank this tribe higher. */
  gap: number;
}

/**
 * Build the comparison rows, scaling each side to its own top tribe so "you" and
 * "others" are compared by shape rather than by two incomparable absolute scales.
 * Sorted by each tribe's more prominent side so the salient tribes lead; ties keep
 * the inputs' canonical (tribe number) order.
 */
function comparisonRows(
  self: TribeScore[],
  others: TribeScore[],
): ComparisonRow[] {
  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));
  const selfMax = Math.max(0, ...self.map((s) => s.score));
  const othersMax = Math.max(0, ...others.map((s) => s.score));

  return self
    .map((s) => {
      const selfRelative = selfMax > 0 ? s.score / selfMax : 0;
      const othersRelative =
        othersMax > 0 ? (othersBySlug.get(s.slug) ?? 0) / othersMax : 0;
      return {
        slug: s.slug,
        name: s.name,
        selfRelative,
        othersRelative,
        gap: othersRelative - selfRelative,
      };
    })
    .sort(
      (a, b) =>
        // stable sort keeps canonical order within ties
        Math.max(b.selfRelative, b.othersRelative) -
        Math.max(a.selfRelative, a.othersRelative),
    );
}

/**
 * Pick the standout tribes: the one both profiles rank most alike near the top
 * (highest shared relative prominence) and the ones that diverge most (largest
 * gap in relative prominence, either direction).
 */
function highlights(rows: ComparisonRow[]): {
  agreement: ComparisonRow | null;
  divergences: ComparisonRow[];
} {
  const agreement =
    [...rows]
      .filter((r) => r.selfRelative > 0 && r.othersRelative > 0)
      .sort(
        (a, b) =>
          Math.min(b.selfRelative, b.othersRelative) -
          Math.min(a.selfRelative, a.othersRelative),
      )[0] ?? null;

  const divergences = [...rows]
    .filter((r) => Math.abs(r.gap) > 0)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

  return { agreement, divergences };
}

function PairBar({ row, role }: { row: ComparisonRow; role: string | null }) {
  const tribe = getTribeBySlug(row.slug);
  const accent = accentHex(tribe?.color ?? "");
  return (
    <li className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]">
      <span className="flex flex-col">
        <span
          className="font-serif text-[17px] leading-tight"
          style={{ color: role ? accent : undefined }}
        >
          {row.name}
        </span>
        {role && (
          <span className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-faint">
            {role}
          </span>
        )}
      </span>
      <div className="flex flex-col gap-1.5">
        <Bar
          relative={row.selfRelative}
          accent={accent}
          opacity={1}
          label={`You rank ${row.name} at ${Math.round(row.selfRelative * 100)}% of your top tribe`}
        />
        <Bar
          relative={row.othersRelative}
          accent={accent}
          opacity={0.4}
          label={`Others rank ${row.name} at ${Math.round(row.othersRelative * 100)}% of their top tribe`}
        />
      </div>
    </li>
  );
}

function Bar({
  relative,
  accent,
  opacity,
  label,
}: {
  relative: number;
  accent: string;
  opacity: number;
  label: string;
}) {
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          // Give any non-zero score a visible sliver so a small bar still reads.
          width: relative > 0 ? `${Math.max(relative * 100, 3)}%` : "0%",
          backgroundColor: accent,
          opacity,
        }}
      />
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.14em] text-faint">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-4 rounded-full bg-ink" aria-hidden />
        You
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-4 rounded-full bg-ink/40" aria-hidden />
        Others
      </span>
    </div>
  );
}

function Callout({
  label,
  slug,
  detail,
}: {
  label: string;
  slug: string;
  detail: string;
}) {
  const tribe = getTribeBySlug(slug);
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
        {tribe?.name ?? slug}
      </div>
      <p className="mt-1.5 text-[14px] leading-snug text-muted">{detail}</p>
    </div>
  );
}

/** One anonymous observer's top tribes, drawn relative to their own top score. */
function ObserverColumn({ observer }: { observer: ComparisonObserver }) {
  // Only tribes this observer actually pointed at, most prominent first.
  const ranked = [...observer.scores]
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const max = ranked.length > 0 ? ranked[0].score : 0;

  return (
    <div>
      <div className="text-[12px] uppercase tracking-[0.16em] text-muted">
        Observer {observer.index}
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {ranked.map((tribeScore) => {
          const tribe = getTribeBySlug(tribeScore.slug);
          const accent = accentHex(tribe?.color ?? "");
          const relative = max > 0 ? tribeScore.score / max : 0;
          return (
            <li
              key={tribeScore.slug}
              className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
            >
              <span className="text-[14px] text-ink">{tribeScore.name}</span>
              <Bar
                relative={relative}
                accent={accent}
                opacity={0.75}
                label={`Observer ${observer.index} ranks ${tribeScore.name} at ${Math.round(relative * 100)}% of their top tribe`}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
