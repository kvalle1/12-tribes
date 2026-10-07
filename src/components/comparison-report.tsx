import { ChevronDown } from "lucide-react";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import {
  aggregateObservers,
  compareSelfToOthers,
  type ComparisonRow,
} from "@/lib/assessment/aggregate";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * beside the equal-weight "others" profile aggregated from anonymous observers,
 * the sharpest points of agreement and divergence, and an anonymous per-observer
 * drill-down.
 *
 * Server component: it scores the Subject and every observer with the pure core,
 * which is `server-only` (the word→tribe mapping never reaches the client,
 * ADR-0009). The observer selections it receives are already anonymous — bare
 * word-arrays in a stable order — so the "Observer 1/2/3" numbering carries no
 * identity.
 *
 * The caller is responsible for the ≥3-observer unlock gate; this component
 * assumes it is only rendered once enough observers have responded.
 */
export function ComparisonReport({
  selfWords,
  observerSelections,
}: {
  selfWords: string[];
  observerSelections: string[][];
}) {
  const self = score(selfWords);
  const { others, observerCount, perObserver } =
    aggregateObservers(observerSelections);
  const { rows, divergences } = compareSelfToOthers(self, others);

  // A shared scale so "you" and "others" bars are directly comparable both
  // within a tribe and across tribes.
  const max = Math.max(...rows.map((r) => Math.max(r.self, r.others)), 0);

  // Lead with the tribes that carry the most signal in either profile.
  const ordered = [...rows].sort(
    (a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others),
  );

  // The sharpest divergences, and — among tribes both sides actually see — the
  // closest agreement.
  const topDivergences = divergences
    .filter((r) => Math.abs(r.gap) > 0)
    .slice(0, 3);
  // "Most alike" = the strongest *shared* signal: the tribe both sides see most
  // of (highest min(self, others)), tie-broken by the closest gap. Weighting by
  // the shared floor keeps two tiny-but-close scores from beating a strong,
  // mutually-recognized tribe.
  const agreement = [...rows]
    .filter((r) => r.self > 0 && r.others > 0)
    .sort((a, b) => {
      const shared = Math.min(b.self, b.others) - Math.min(a.self, a.others);
      return shared !== 0 ? shared : Math.abs(a.gap) - Math.abs(b.gap);
    })[0];

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        A 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        You, and how others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Your own word selection beside the combined read of{" "}
        {observerCount} {observerCount === 1 ? "person" : "people"} who described
        you. Each observer is weighed equally, so no single voice — however many
        words they picked — counts for more than another.
      </p>

      {/* Alignment & divergence summary — the gap is where growth lives. */}
      <section className="mt-12 grid gap-6 sm:grid-cols-2">
        <div className="rounded-[3px] border border-hair bg-white/60 p-6">
          <p className="text-[12px] uppercase tracking-[0.18em] text-faint">
            Where you agree
          </p>
          {agreement ? (
            <p className="mt-3 text-[15px] leading-relaxed text-ink">
              You and your observers see{" "}
              <TribeName slug={agreement.slug} /> most alike.
            </p>
          ) : (
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              You and your observers haven&rsquo;t landed on common ground yet.
            </p>
          )}
        </div>
        <div className="rounded-[3px] border border-hair bg-white/60 p-6">
          <p className="text-[12px] uppercase tracking-[0.18em] text-faint">
            Where you differ most
          </p>
          {topDivergences.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-2 text-[15px] leading-relaxed text-ink">
              {topDivergences.map((row) => (
                <li key={row.slug}>
                  <DivergenceNote row={row} />
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

      {/* Side-by-side bars for every tribe. */}
      <section className="mt-16 border-t border-hair pt-8">
        <div className="flex items-baseline justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Self vs. others, tribe by tribe
          </p>
          <Legend />
        </div>
        <ul className="mt-7 flex flex-col gap-6">
          {ordered.map((row) => (
            <CompareRow key={row.slug} row={row} max={max} />
          ))}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down. Native <details> keeps it server-side
          and interaction-free — no observer identity ever reaches the client. */}
      <section className="mt-16 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each read, anonymously
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          The individual reads behind the average, with no names attached.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          {perObserver.map((profile, i) => (
            <ObserverDrilldown key={i} index={i} profile={profile} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.12em] text-faint">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-ink" aria-hidden />
        You
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="h-2.5 w-2.5 rounded-full border border-ink/60"
          aria-hidden
        />
        Others
      </span>
    </div>
  );
}

function CompareRow({ row, max }: { row: ComparisonRow; max: number }) {
  const tribe = getTribeBySlug(row.slug);
  const accent = accentHex(tribe?.color ?? "");
  const selfPct = max > 0 ? (row.self / max) * 100 : 0;
  const othersPct = max > 0 ? (row.others / max) * 100 : 0;

  return (
    <li className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]">
      <span className="font-serif text-[17px] leading-tight" style={{ color: accent }}>
        {row.name}
      </span>
      <div className="flex flex-col gap-1.5">
        {/* One spoken summary per tribe instead of a label on each decorative
            bar, so a screen reader hears "you X, others Y" once rather than twice. */}
        <span className="sr-only">
          {row.name}: you {Math.round(selfPct)}%, others{" "}
          {Math.round(othersPct)}% of the strongest score.
        </span>
        <Bar pct={selfPct} hasSignal={row.self > 0} accent={accent} variant="self" />
        <Bar
          pct={othersPct}
          hasSignal={row.others > 0}
          accent={accent}
          variant="others"
        />
      </div>
    </li>
  );
}

function Bar({
  pct,
  hasSignal,
  accent,
  variant,
}: {
  pct: number;
  hasSignal: boolean;
  accent: string;
  variant: "self" | "others";
}) {
  const width = `${Math.max(pct, hasSignal ? 3 : 0)}%`;
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-hair/50" aria-hidden>
      <div
        className="h-full rounded-full"
        style={
          variant === "self"
            ? { width, backgroundColor: accent }
            : {
                width,
                backgroundColor: "transparent",
                border: `1.5px solid ${accent}`,
              }
        }
      />
    </div>
  );
}

function ObserverDrilldown({
  index,
  profile,
}: {
  index: number;
  profile: TribeScore[];
}) {
  const ranked = rankScores(profile);
  const top = ranked.find((r) => r.score > 0) ?? ranked[0];
  const topTribe = top ? getTribeBySlug(top.slug) : undefined;

  return (
    <details className="rounded-[3px] border border-hair bg-white/60 [&_summary]:cursor-pointer [&[open]_.cmp-caret]:rotate-180">
      <summary className="flex items-center gap-3 px-5 py-3.5 text-[14px] text-ink marker:content-[''] [&::-webkit-details-marker]:hidden">
        <span className="font-serif text-[16px]">Observer {index + 1}</span>
        <span className="ml-auto flex items-center gap-3">
          {top && top.score > 0 && (
            <span className="text-[12px] uppercase tracking-[0.12em] text-faint">
              Reads you as{" "}
              <span style={{ color: accentHex(topTribe?.color ?? "") }}>
                {top.name}
              </span>
            </span>
          )}
          <ChevronDown
            className="cmp-caret size-4 shrink-0 text-faint transition-transform"
            aria-hidden
          />
        </span>
      </summary>
      <ul className="flex flex-col gap-2.5 border-t border-hair px-5 py-4">
        {ranked.map((r) => {
          const tribe = getTribeBySlug(r.slug);
          const accent = accentHex(tribe?.color ?? "");
          return (
            <li
              key={r.slug}
              className="grid grid-cols-[110px_1fr] items-center gap-3 max-[520px]:grid-cols-[88px_1fr]"
            >
              <span className="text-[14px] text-muted">{r.name}</span>
              <div
                className="h-2 overflow-hidden rounded-full bg-hair/50"
                aria-hidden
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(r.relative * 100, r.score > 0 ? 3 : 0)}%`,
                    backgroundColor: accent,
                    opacity: 0.7,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function TribeName({ slug }: { slug: string }) {
  const tribe = getTribeBySlug(slug);
  return (
    <span className="font-medium" style={{ color: accentHex(tribe?.color ?? "") }}>
      {tribe?.name ?? slug}
    </span>
  );
}

function DivergenceNote({ row }: { row: ComparisonRow }) {
  // gap = self − others. Positive: the Subject sees more of this tribe than
  // others do; negative: others see more than the Subject does.
  return row.gap > 0 ? (
    <>
      You see more <TribeName slug={row.slug} /> in yourself than others do.
    </>
  ) : (
    <>
      Others see more <TribeName slug={row.slug} /> in you than you do.
    </>
  );
}
