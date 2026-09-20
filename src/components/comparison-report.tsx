import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { rankScores } from "@/lib/assessment/ranking";
import type { TribeScore } from "@/lib/assessment/score";
import type { TribeComparison } from "@/lib/assessment/aggregateObservers";

/**
 * The self-vs-others 360 comparison report (issue #9, ADR-0003) — rendered only
 * once at least three Observers have responded (the locked state below the
 * threshold is handled by the report page). It shows the Subject's own Strength
 * Profile alongside the equal-weight aggregated "others" profile, calls out
 * where the two agree and where they diverge, and offers an anonymous
 * per-observer drill-down.
 *
 * Purely presentational: it takes already-computed, plain numeric profiles and
 * imports nothing server-only (the scoring/aggregation ran server-side on the
 * report page). `accentHex`, `getTribeBySlug`, and `rankScores` are all
 * client-safe. Observers are only ever labelled "Observer 1/2/3" — no attribute
 * that could identify one is present in the data or the markup.
 */
export function ComparisonReport({
  observerCount,
  comparison,
  perObserver,
}: {
  observerCount: number;
  comparison: TribeComparison[];
  perObserver: TribeScore[][];
}) {
  // Scale both columns to one shared maximum so the self and others bars are
  // directly comparable rather than each self-normalized.
  const maxScore = Math.max(
    ...comparison.map((row) => Math.max(row.self, row.others)),
    0,
  );

  // Most prominent tribes first (by the stronger of the two reads), so the rows
  // that carry signal sit at the top.
  const rows = [...comparison].sort(
    (a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others),
  );

  // Strongest shared read: the tribe both the Subject and others score highest
  // in common (largest floor across the two profiles).
  const alignment = [...comparison].sort(
    (a, b) => Math.min(b.self, b.others) - Math.min(a.self, a.others),
  )[0];

  // Widest gap: the tribe where self and others most disagree.
  const divergence = [...comparison].sort(
    (a, b) => Math.abs(b.delta) - Math.abs(a.delta),
  )[0];

  const showAlignment = alignment && Math.min(alignment.self, alignment.others) > 0;
  const showDivergence = divergence && Math.abs(divergence.delta) > 0.01;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,54px)] font-semibold leading-[1.04]">
        How others see you
      </h1>
      <p className="mt-3 max-w-[560px] text-[15px] text-muted">
        Drawn from{" "}
        <span className="text-ink">{observerCount} anonymous observers</span>,
        each weighted equally. Your own read sits beside theirs below — the gap
        between them is where the most useful insight lives.
      </p>

      {/* Alignment / divergence highlights. */}
      {(showAlignment || showDivergence) && (
        <div className="mt-10 grid gap-4 min-[560px]:grid-cols-2">
          {showAlignment && (
            <Highlight
              label="Where you agree"
              tribeName={alignment.name}
              accent={accentHex(getTribeBySlug(alignment.slug)?.color ?? "")}
              body={`You and your observers both read ${alignment.name} strongly. It's the clearest common ground in how you're seen.`}
            />
          )}
          {showDivergence && (
            <Highlight
              label="Where you diverge"
              tribeName={divergence.name}
              accent={accentHex(getTribeBySlug(divergence.slug)?.color ?? "")}
              body={
                divergence.delta > 0
                  ? `Others read ${divergence.name} in you more than you read it in yourself — a strength they may see that you discount.`
                  : `You read ${divergence.name} in yourself more than others do — how you experience it may be quieter from the outside.`
              }
            />
          )}
        </div>
      )}

      {/* Self vs others, tribe by tribe. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-center justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            You vs. others
          </p>
          <Legend />
        </div>
        <ul className="mt-6 flex flex-col gap-5">
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
                  <CompareBar
                    kind="self"
                    label="You"
                    value={row.self}
                    max={maxScore}
                    accent={accent}
                    tribeName={row.name}
                  />
                  <CompareBar
                    kind="others"
                    label="Others"
                    value={row.others}
                    max={maxScore}
                    accent={accent}
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
          Observer by observer
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Each observer&rsquo;s individual read, fully anonymous. Expand one to
          see the spread of opinion without knowing who said what.
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          {perObserver.map((profile, index) => (
            <ObserverDrilldown
              key={index}
              index={index}
              profile={profile}
            />
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
        <span
          className="inline-block h-2.5 w-2.5 rounded-full border border-ink/40"
          aria-hidden
        />
        You
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full bg-ink/70"
          aria-hidden
        />
        Others
      </span>
    </div>
  );
}

function CompareBar({
  kind,
  label,
  value,
  max,
  accent,
  tribeName,
}: {
  kind: "self" | "others";
  label: string;
  value: number;
  max: number;
  accent: string;
  tribeName: string;
}) {
  const fraction = max > 0 ? value / max : 0;
  const width = Math.max(fraction * 100, value > 0 ? 2 : 0);
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[42px] shrink-0 text-[10px] uppercase tracking-[0.1em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${tribeName}, ${label.toLowerCase()}: ${Math.round(
          fraction * 100,
        )}% of the strongest read`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${width}%`,
            backgroundColor: accent,
            // The Subject's own read is drawn hollow-ish (dimmer) and the others'
            // read solid, matching the legend, so the two never blur together.
            opacity: kind === "self" ? 0.45 : 0.9,
          }}
        />
      </div>
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
  const top = ranked.filter((t) => t.score > 0).slice(0, 5);
  const lead = top[0];
  const leadAccent = lead
    ? accentHex(getTribeBySlug(lead.slug)?.color ?? "")
    : undefined;

  return (
    <details className="group rounded-[2px] border border-hair open:border-gold/40">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[15px] [&::-webkit-details-marker]:hidden">
        <span className="font-serif">Observer {index + 1}</span>
        <span className="flex items-center gap-2 text-[13px] text-muted">
          {lead && (
            <span style={{ color: leadAccent }}>reads you as {lead.name}</span>
          )}
          <span
            className="text-faint transition-transform group-open:rotate-90"
            aria-hidden
          >
            ›
          </span>
        </span>
      </summary>
      <ul className="flex flex-col gap-2.5 border-t border-hair px-4 py-4">
        {top.length === 0 && (
          <li className="text-[13px] text-muted">No words in common.</li>
        )}
        {top.map((row) => {
          const accent = accentHex(getTribeBySlug(row.slug)?.color ?? "");
          return (
            <li
              key={row.slug}
              className="grid grid-cols-[104px_1fr] items-center gap-3 max-[520px]:grid-cols-[84px_1fr]"
            >
              <span className="text-[14px]">{row.name}</span>
              <div
                className="h-2 overflow-hidden rounded-full bg-hair/50"
                role="img"
                aria-label={`${row.name}: ${Math.round(
                  row.relative * 100,
                )}% of this observer's top read`}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(row.relative * 100, 3)}%`,
                    backgroundColor: accent,
                    opacity: 0.8,
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

function Highlight({
  label,
  tribeName,
  accent,
  body,
}: {
  label: string;
  tribeName: string;
  accent: string;
  body: string;
}) {
  return (
    <div
      className="rounded-[2px] border border-hair p-5"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
        {label}
      </div>
      <div className="mt-1.5 font-serif text-[22px]" style={{ color: accent }}>
        {tribeName}
      </div>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">{body}</p>
    </div>
  );
}
