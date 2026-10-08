import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import {
  MIN_OBSERVERS_FOR_REPORT,
  type ObserverAggregate,
} from "@/lib/assessment/aggregate-observers";
import type { TribeScore } from "@/lib/assessment/score";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). Shows the
 * Subject's own profile alongside the equal-weight aggregated "others" profile,
 * calls out where the two views align and diverge, and offers an anonymous
 * per-observer drill-down (Observer 1 / 2 / 3 …).
 *
 * The report is locked until at least {@link MIN_OBSERVERS_FOR_REPORT} Observers
 * have responded; before then it renders a clear locked state with the running
 * count so the Subject knows how many more reads they need.
 *
 * Server component: it imports the `server-only` scoring core to compute the
 * Subject's profile from their saved words, so the word→tribe mapping never
 * reaches the client (ADR-0009).
 */
export function ComparisonReport({
  selfWords,
  aggregate,
}: {
  selfWords: string[];
  aggregate: ObserverAggregate;
}) {
  if (aggregate.count < MIN_OBSERVERS_FOR_REPORT) {
    return <LockedState count={aggregate.count} />;
  }

  const self = score(selfWords);
  const rows = buildRows(self, aggregate.others);
  const { aligned, divergences } = highlights(rows);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 reflection
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,52px)] font-semibold leading-[1.05]">
        How others see you
      </h1>
      <p className="mt-3 max-w-[560px] text-[16px] text-muted">
        Your own read sits beside the combined read of{" "}
        <span className="text-ink">{aggregate.count}</span> people who answered
        anonymously. Each person counts equally, however many words they picked.
        The gap between the two is where the most useful insight tends to live.
      </p>

      {/* Alignment / divergence call-outs. */}
      {(aligned || divergences.length > 0) && (
        <section className="mt-12 flex flex-col gap-3">
          {aligned && (
            <Highlight
              kind="aligned"
              slug={aligned.slug}
              label={`You and others agree most on ${aligned.name}`}
            />
          )}
          {divergences.map((d) => (
            <Highlight
              key={d.slug}
              kind={d.self > d.others ? "self-higher" : "others-higher"}
              slug={d.slug}
              label={
                d.self > d.others
                  ? `You see more ${d.name} in yourself than others do`
                  : `Others see more ${d.name} in you than you do`
              }
            />
          ))}
        </section>
      )}

      {/* Side-by-side bars for all twelve tribes. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-center justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            You vs others
          </p>
          <p className="flex items-center gap-4 text-[11px] uppercase tracking-[0.14em] text-faint">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink" />
              You
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-gold" />
              Others
            </span>
          </p>
        </div>
        <ul className="mt-6 flex flex-col gap-5">
          {rows.map((row) => (
            <li
              key={row.slug}
              className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
            >
              <span
                className="font-serif text-[17px] leading-tight"
                style={{ color: accentHex(row.color) }}
              >
                {row.name}
              </span>
              <div className="flex flex-col gap-1.5">
                <CompareBar
                  label={`You: ${pct(row.self)}`}
                  fraction={row.selfRelative}
                  color="var(--ink)"
                  name={row.name}
                  who="You"
                />
                <CompareBar
                  label={`Others: ${pct(row.others)}`}
                  fraction={row.othersRelative}
                  color={accentHex(row.color)}
                  name={row.name}
                  who="Others"
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each read, anonymously
        </p>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          The top tribes in each individual read. Responses are anonymous — no
          name, relationship, or any attribute is ever stored or shown alongside a
          read.
        </p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {aggregate.perObserver.map((profile, i) => (
            <li
              key={i}
              className="rounded-[3px] border border-hair bg-white/40 p-5"
            >
              <p className="text-[11px] uppercase tracking-[0.18em] text-faint">
                Observer {i + 1}
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {topTribes(profile).map((t) => (
                  <li key={t.slug} className="flex items-center gap-2.5">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: accentHex(
                          getTribeBySlug(t.slug)?.color ?? "",
                        ),
                      }}
                    />
                    <span className="font-serif text-[15px]">{t.name}</span>
                    <span className="ml-auto text-[12px] tabular-nums text-faint">
                      {pct(t.score)}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-14 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Back to your result
        </Link>
      </div>
    </div>
  );
}

/** A single comparison bar, scaled to a fraction of the shared top score. */
function CompareBar({
  label,
  fraction,
  color,
  name,
  who,
}: {
  label: string;
  fraction: number;
  color: string;
  name: string;
  who: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${who} scored ${name} at ${Math.round(fraction * 100)}% of the top score`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(fraction * 100, fraction > 0 ? 3 : 0)}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span className="w-[108px] shrink-0 text-right text-[11px] tabular-nums tracking-[0.04em] text-faint">
        {label}
      </span>
    </div>
  );
}

function Highlight({
  kind,
  slug,
  label,
}: {
  kind: "aligned" | "self-higher" | "others-higher";
  slug: string;
  label: string;
}) {
  const accent = accentHex(getTribeBySlug(slug)?.color ?? "");
  const tag =
    kind === "aligned"
      ? "Aligned"
      : kind === "self-higher"
        ? "You lean higher"
        : "Others lean higher";
  return (
    <div
      className="flex items-center gap-3 rounded-[3px] border border-hair bg-white/40 px-4 py-3"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <span className="text-[10px] uppercase tracking-[0.16em] text-faint">
        {tag}
      </span>
      <span className="text-[15px] text-ink">{label}</span>
    </div>
  );
}

function LockedState({ count }: { count: number }) {
  const remaining = MIN_OBSERVERS_FOR_REPORT - count;
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 reflection
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,52px)] font-semibold leading-[1.05]">
        Not unlocked yet
      </h1>
      <p className="mt-4 max-w-[540px] text-[16px] text-muted">
        The comparison opens once at least {MIN_OBSERVERS_FOR_REPORT} people have
        shared their read of you — enough that the combined view is meaningful and
        no single person can be singled out.
      </p>

      <div className="mt-10 flex items-center gap-4">
        <div className="flex gap-2" aria-hidden>
          {Array.from({ length: MIN_OBSERVERS_FOR_REPORT }).map((_, i) => (
            <span
              key={i}
              className={`h-2.5 w-9 rounded-full ${
                i < count ? "bg-gold" : "bg-hair"
              }`}
            />
          ))}
        </div>
        <p className="text-[14px] text-muted">
          <span className="text-ink">{count}</span> of{" "}
          {MIN_OBSERVERS_FOR_REPORT} responses so far
          {remaining > 0 && (
            <>
              {" "}
              — {remaining} more to go
            </>
          )}
          .
        </p>
      </div>

      <div className="mt-12 border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Back to your result to share your link
        </Link>
      </div>
    </div>
  );
}

interface CompareRow {
  slug: string;
  name: string;
  color: string;
  self: number;
  others: number;
  /** Bar fill for the self score, relative to the top score across both views. */
  selfRelative: number;
  /** Bar fill for the others score, relative to the top score across both views. */
  othersRelative: number;
  /** self − others; positive means the Subject rates this tribe higher. */
  gap: number;
}

/**
 * Join the self and others profiles into one row per tribe, ranked by the louder
 * of the two views so the tribes that matter to either side rise to the top.
 * Bars are scaled to a shared maximum so the two profiles read on one axis.
 */
function buildRows(self: TribeScore[], others: TribeScore[]): CompareRow[] {
  const othersBySlug = new Map(others.map((o) => [o.slug, o.score]));
  const sharedMax =
    Math.max(
      0,
      ...self.map((s) => s.score),
      ...others.map((o) => o.score),
    ) || 1;

  return self
    .map((s) => {
      const tribe = getTribeBySlug(s.slug);
      const othersScore = othersBySlug.get(s.slug) ?? 0;
      return {
        slug: s.slug,
        name: s.name,
        color: tribe?.color ?? "",
        self: s.score,
        others: othersScore,
        selfRelative: s.score / sharedMax,
        othersRelative: othersScore / sharedMax,
        gap: s.score - othersScore,
      };
    })
    .sort((a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others));
}

/**
 * Pick the call-out tribes: the strongest agreement (both views meaningfully
 * present with the smallest gap) and the sharpest divergence in each direction.
 * Everything is derived from the already-normalized scores; a small epsilon keeps
 * near-zero noise from being reported as a divergence.
 */
function highlights(rows: CompareRow[]): {
  aligned: CompareRow | null;
  divergences: CompareRow[];
} {
  const EPSILON = 0.05;

  // "Agree most" should reward a strongly shared tribe, not merely the smallest
  // gap — otherwise two tribes both barely present (0.06 vs 0.06) would outrank a
  // strong shared one (0.80 vs 0.79). Score by shared strength (the lower of the
  // two views) minus the disagreement between them, and take the best.
  const present = rows.filter((r) => r.self > EPSILON && r.others > EPSILON);
  const alignmentScore = (r: CompareRow) =>
    Math.min(r.self, r.others) - Math.abs(r.gap);
  const aligned =
    present.length > 0
      ? present.reduce((best, r) =>
          alignmentScore(r) > alignmentScore(best) ? r : best,
        )
      : null;

  const selfHigher = rows
    .filter((r) => r.gap > EPSILON)
    .sort((a, b) => b.gap - a.gap)[0];
  const othersHigher = rows
    .filter((r) => r.gap < -EPSILON)
    .sort((a, b) => a.gap - b.gap)[0];

  const divergences = [selfHigher, othersHigher].filter(
    (r): r is CompareRow => Boolean(r) && r.slug !== aligned?.slug,
  );

  return { aligned, divergences };
}

/** The top-scoring tribes in a single profile, for the drill-down. */
function topTribes(profile: TribeScore[], limit = 3): TribeScore[] {
  return [...profile]
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Format a normalized 0–1 score as a whole percentage. */
function pct(score: number): string {
  return `${Math.round(score * 100)}%`;
}
