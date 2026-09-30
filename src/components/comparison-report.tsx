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
  const byMax = comparisonRows(self, others);
  const { agreement, divergences } = highlights(byMax);

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
          {byMax.map((row) => (
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

/** A tribe row carrying both profiles' scores and their shared-scale fractions. */
interface ComparisonRow {
  slug: string;
  name: string;
  selfScore: number;
  othersScore: number;
  /** Bar fills relative to the largest score across both profiles. */
  selfRelative: number;
  othersRelative: number;
  /** othersScore − selfScore: positive means observers see more of this tribe. */
  gap: number;
}

/**
 * Build the comparison rows on a single shared scale (the largest score across
 * both profiles) so the "you" and "others" bars are directly comparable, sorted
 * by each tribe's more prominent side so the salient tribes lead. Ties keep the
 * inputs' canonical (tribe number) order.
 */
function comparisonRows(
  self: TribeScore[],
  others: TribeScore[],
): ComparisonRow[] {
  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));
  const max = Math.max(
    0,
    ...self.map((s) => s.score),
    ...others.map((s) => s.score),
  );

  return self
    .map((s) => {
      const othersScore = othersBySlug.get(s.slug) ?? 0;
      return {
        slug: s.slug,
        name: s.name,
        selfScore: s.score,
        othersScore,
        selfRelative: max > 0 ? s.score / max : 0,
        othersRelative: max > 0 ? othersScore / max : 0,
        gap: othersScore - s.score,
      };
    })
    .sort((a, b) => {
      const prominence =
        Math.max(b.selfScore, b.othersScore) -
        Math.max(a.selfScore, a.othersScore);
      return prominence; // stable sort keeps canonical order within ties
    });
}

/**
 * Pick the standout tribes: the one where both profiles agree most strongly
 * (highest shared floor) and the ones that diverge most (largest gap either way).
 */
function highlights(rows: ComparisonRow[]): {
  agreement: ComparisonRow | null;
  divergences: ComparisonRow[];
} {
  const agreement =
    [...rows]
      .filter((r) => r.selfScore > 0 && r.othersScore > 0)
      .sort(
        (a, b) =>
          Math.min(b.selfScore, b.othersScore) -
          Math.min(a.selfScore, a.othersScore),
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
          score={row.selfScore}
          accent={accent}
          opacity={1}
          label={`You: ${Math.round(row.selfRelative * 100)} of 100`}
        />
        <Bar
          relative={row.othersRelative}
          score={row.othersScore}
          accent={accent}
          opacity={0.4}
          label={`Others: ${Math.round(row.othersRelative * 100)} of 100`}
        />
      </div>
    </li>
  );
}

function Bar({
  relative,
  score,
  accent,
  opacity,
  label,
}: {
  relative: number;
  score: number;
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
          width: `${Math.max(relative * 100, score > 0 ? 3 : 0)}%`,
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
  const ranked = [...observer.scores]
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
                score={tribeScore.score}
                accent={accent}
                opacity={0.75}
                label={`${tribeScore.name}: ${Math.round(relative * 100)} of 100 for observer ${observer.index}`}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
