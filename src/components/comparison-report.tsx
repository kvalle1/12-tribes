import { getTribeBySlug, type Tribe } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";
import { aggregateObservers } from "@/lib/assessment/aggregate-observers";
import { hasEnoughObservers } from "@/lib/assessment/constants";

/**
 * The 360 comparison report (issue #9): the Subject's own profile laid beside the
 * equal-weight aggregate of how their Observers see them, with the alignments and
 * gaps called out and an anonymous per-observer drill-down.
 *
 * It renders from raw words only — the Subject's selection and each Observer's
 * selection — and does all scoring here via the `server-only` core, so the
 * word→tribe mapping never reaches the client (ADR-0009). Render it only from
 * server components, and only once at least three Observers have responded
 * (the caller gates on `hasEnoughObservers`).
 */
export function ComparisonReport({
  selfWords,
  observerWordSets,
}: {
  selfWords: string[];
  observerWordSets: string[][];
}) {
  // The ≥3 anonymity threshold (ADR-0003) is owned here too, not only at the
  // call site, so a future direct render can never surface the per-observer
  // drill-down below the threshold.
  if (!hasEnoughObservers(observerWordSets.length)) return null;

  const self = score(selfWords);
  const { others, perObserver, count } = aggregateObservers(observerWordSets);

  const othersBy = byslug(others);

  // One row per tribe with both scores and the signed gap (self − others).
  const rows = self
    .map((s) => {
      const o = othersBy[s.slug].score;
      return { slug: s.slug, name: s.name, self: s.score, others: o, gap: s.score - o };
    })
    // Most prominent tribes (by either view) first.
    .sort((a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others));

  const max = Math.max(1e-9, ...rows.map((r) => Math.max(r.self, r.others)));

  const { alignment, divergence } = highlights(rows);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read · {count} observers
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        You, and how others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        Your own profile beside the equal-weight average of your observers&rsquo;
        reads — each observer counted once, however many words they picked. Where
        the two disagree is where the most useful insight lives.
      </p>

      {/* Alignment / divergence call-outs. */}
      <section className="mt-10 grid grid-cols-2 gap-4 max-[520px]:grid-cols-1">
        <Callout
          label="Strongest agreement"
          tribe={alignment ? getTribeBySlug(alignment.slug) : undefined}
          detail={
            alignment
              ? "You and your observers both place this high."
              : "No clear shared high yet."
          }
        />
        <Callout
          label="Biggest gap"
          tribe={divergence ? getTribeBySlug(divergence.slug) : undefined}
          detail={
            divergence && divergence.gap !== 0
              ? divergence.gap > 0
                ? "You rate this higher than your observers do."
                : "Your observers rate this higher than you do."
              : "You and your observers largely agree."
          }
        />
      </section>

      {/* Side-by-side bars for all twelve tribes. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-center justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            You vs. others, tribe by tribe
          </p>
          <Legend />
        </div>
        <ul className="mt-6 flex flex-col gap-5">
          {rows.map((row) => (
            <li key={row.slug} className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]">
              <span className="font-serif text-[17px] leading-tight">{row.name}</span>
              <div className="flex flex-col gap-1.5">
                <PairBar label="You" fraction={row.self / max} tone="you" />
                <PairBar label="Others" fraction={row.others / max} tone="others" />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each observer, anonymously
        </p>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          The spread of opinion, one observer at a time. Observers are shown only
          as a number — nothing identifies who answered.
        </p>
        <ul className="mt-6 flex flex-col gap-5">
          {perObserver.map((profile, i) => (
            <li key={i} className="rounded-[2px] border border-hair p-5">
              <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
                Observer {i + 1}
              </div>
              <ul className="mt-3 flex flex-wrap gap-2.5">
                {topTribes(profile).map((t) => (
                  <li
                    key={t.slug}
                    className="rounded-[2px] border border-gold/40 bg-gold/10 px-3 py-1 text-[13px] text-ink"
                  >
                    {t.name}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.14em] text-faint">
      <span className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-4 rounded-full bg-ink" />
        You
      </span>
      <span className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-4 rounded-full bg-gold" />
        Others
      </span>
    </div>
  );
}

function PairBar({
  label,
  fraction,
  tone,
}: {
  label: string;
  fraction: number;
  tone: "you" | "others";
}) {
  const pct = Math.round(fraction * 100);
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={`${label}: ${pct}% of the top score`}
    >
      <div
        className={`h-full rounded-full transition-[width] ${tone === "you" ? "bg-ink" : "bg-gold"}`}
        style={{ width: `${Math.max(pct, fraction > 0 ? 3 : 0)}%` }}
      />
    </div>
  );
}

function Callout({
  label,
  tribe,
  detail,
}: {
  label: string;
  tribe: Tribe | undefined;
  detail: string;
}) {
  return (
    <div className="rounded-[2px] border border-hair p-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
        {label}
      </div>
      <div className="mt-2 font-serif text-[22px] font-semibold leading-tight">
        {tribe ? tribe.name : "—"}
      </div>
      <p className="mt-2 text-[14px] text-muted">{detail}</p>
    </div>
  );
}

/** Index a score list by slug for O(1) pairing. */
function byslug(scores: TribeScore[]): Record<string, TribeScore> {
  const map: Record<string, TribeScore> = {};
  for (const s of scores) map[s.slug] = s;
  return map;
}

/** The top few tribes of one profile, for the per-observer drill-down. */
function topTribes(profile: TribeScore[], n = 3): TribeScore[] {
  return [...profile]
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

interface Row {
  slug: string;
  name: string;
  self: number;
  others: number;
  gap: number;
}

/**
 * Pick the tribe self and others most agree on (both meaningfully high, smallest
 * gap) and the tribe they most diverge on (largest absolute gap). Returns
 * `undefined` for either when nothing scored, so the caller can show a neutral
 * message rather than a misleading one.
 */
function highlights(rows: Row[]): {
  alignment: Row | undefined;
  divergence: Row | undefined;
} {
  const scored = rows.filter((r) => r.self > 0 || r.others > 0);
  if (scored.length === 0) return { alignment: undefined, divergence: undefined };

  const alignment = [...scored]
    // Reward tribes both sides rate highly, penalize the gap between them.
    .sort(
      (a, b) =>
        Math.min(b.self, b.others) - Math.abs(b.gap) -
        (Math.min(a.self, a.others) - Math.abs(a.gap)),
    )[0];

  const divergence = [...scored].sort(
    (a, b) => Math.abs(b.gap) - Math.abs(a.gap),
  )[0];

  return { alignment, divergence };
}
