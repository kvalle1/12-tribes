import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import {
  aggregateObservers,
  MIN_OBSERVERS,
} from "@/lib/observer/aggregate";

/**
 * The self-vs-others 360 comparison report (issue #9, ADR-0003). It shows the
 * Subject's own Strength Profile beside the **equal-weight** "others" profile
 * aggregated from anonymous Observer responses, highlights where the two reads
 * align and diverge, and offers an anonymous per-observer drill-down
 * (Observer 1/2/3…). The report is **locked until at least `MIN_OBSERVERS`
 * observers have responded**, rendering a clear progress state before then.
 *
 * Server component: it imports the `server-only` scoring core and aggregation
 * (the word→tribe mapping never reaches the client, ADR-0009), so render it only
 * from server components. It takes raw selections and computes profiles here, so
 * the stored words stay the single source of truth and the view can never drift
 * from them — the same pattern as `ResultView`.
 */
export function ComparisonReport({
  selfWords,
  observerWords,
}: {
  selfWords: string[];
  observerWords: string[][];
}) {
  const agg = aggregateObservers(observerWords);

  if (!agg.unlocked) {
    return <LockedState responded={agg.observerCount} />;
  }

  const selfScores = score(selfWords);
  const othersBySlug = new Map(agg.average.map((s) => [s.slug, s.score]));

  // One row per tribe with both reads and the gap between them. Ranked by the
  // stronger of the two so the tribes that matter to either read float to the
  // top; a shared max keeps the two bars on one comparable scale.
  const rows = selfScores
    .map((s) => {
      const others = othersBySlug.get(s.slug) ?? 0;
      return {
        slug: s.slug,
        name: s.name,
        self: s.score,
        others,
        gap: others - s.score,
      };
    })
    .sort((a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others));

  const max = Math.max(1e-9, ...rows.map((r) => Math.max(r.self, r.others)));

  // Surface the single sharpest divergence in each direction (if meaningful).
  const DIVERGENCE_EPSILON = 0.08;
  const othersSeeMore = [...rows].sort((a, b) => b.gap - a.gap)[0];
  const youSeeMore = [...rows].sort((a, b) => a.gap - b.gap)[0];

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read · {agg.observerCount} responses
      </p>
      <h2 className="mt-2 font-serif text-[clamp(30px,5vw,44px)] font-semibold leading-[1.05]">
        You, and how others see you
      </h2>
      <p className="mt-3 max-w-[560px] text-[15px] text-muted">
        Each observer answered anonymously and is weighted equally, so no single
        voice — however many words they picked — outweighs the rest. The gap
        between the two reads is where the most is worth noticing.
      </p>

      {/* Legend */}
      <div className="mt-8 flex items-center gap-6 text-[12px] uppercase tracking-[0.14em] text-faint">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-4 rounded-full bg-ink" />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-4 rounded-full bg-gold" />
          Others
        </span>
      </div>

      {/* Side-by-side bars, all twelve tribes. */}
      <section className="mt-6">
        <ul className="flex flex-col gap-5">
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
                  <CompareBar
                    label="You"
                    value={row.self}
                    max={max}
                    color="var(--ink, #1c1b18)"
                    tribeName={row.name}
                  />
                  <CompareBar
                    label="Others"
                    value={row.others}
                    max={max}
                    color="var(--gold, #a9842f)"
                    tribeName={row.name}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Alignment & divergence callouts. */}
      <section className="mt-14 grid gap-4 border-t border-hair pt-8 sm:grid-cols-2">
        {othersSeeMore && othersSeeMore.gap >= DIVERGENCE_EPSILON ? (
          <Callout
            kicker="Others see more"
            body={`Others lean harder on ${othersSeeMore.name} in you than you do yourself.`}
            slug={othersSeeMore.slug}
          />
        ) : (
          <Callout
            kicker="Close read"
            body="Where others score you highest, you largely agree — no tribe stands out as underclaimed."
          />
        )}
        {youSeeMore && -youSeeMore.gap >= DIVERGENCE_EPSILON ? (
          <Callout
            kicker="You see more"
            body={`You claim more ${youSeeMore.name} in yourself than others tend to see.`}
            slug={youSeeMore.slug}
          />
        ) : (
          <Callout
            kicker="Close read"
            body="You don't lean on any tribe far beyond how others see you — your self-read is grounded."
          />
        )}
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each observer, anonymously
        </p>
        <p className="mt-2 max-w-[560px] text-[15px] text-muted">
          Every response is unlabelled — no names, no relationships — so you see
          only the shape of each read, never who gave it.
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {agg.perObserver.map((profile, i) => (
            <ObserverCard key={i} index={i + 1} profile={profile} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function CompareBar({
  label,
  value,
  max,
  color,
  tribeName,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  tribeName: string;
}) {
  const pct = Math.max((value / max) * 100, value > 0 ? 3 : 0);
  return (
    <div className="flex items-center gap-3">
      <span className="w-[46px] shrink-0 text-[10px] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${tribeName}, ${label.toLowerCase()}: ${Math.round(
          (value / max) * 100,
        )}% of the strongest read`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function Callout({
  kicker,
  body,
  slug,
}: {
  kicker: string;
  body: string;
  slug?: string;
}) {
  const tribe = slug ? getTribeBySlug(slug) : undefined;
  return (
    <div className="rounded-[2px] border border-hair p-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
        {kicker}
      </div>
      <p className="mt-2 text-[15px] leading-relaxed text-ink">{body}</p>
      {tribe && (
        <Link
          href={`/tribes/${tribe.slug}`}
          className="mt-3 inline-block border-b border-gold pb-0.5 text-[12px] tracking-[0.06em] text-ink transition-colors hover:text-gold"
        >
          Read the {tribe.name} profile
        </Link>
      )}
    </div>
  );
}

function ObserverCard({
  index,
  profile,
}: {
  index: number;
  profile: { slug: string; name: string; score: number }[];
}) {
  const ranked = rankScores(profile).filter((r) => r.score > 0);
  const top = ranked.slice(0, 2);
  return (
    <li className="rounded-[2px] border border-hair p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
        Observer {index}
      </div>
      {top.length === 0 ? (
        <p className="mt-2 text-[14px] text-muted">No clear lean.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {top.map((row, i) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li key={row.slug} className="flex items-baseline gap-2">
                <span
                  className="font-serif text-[16px]"
                  style={{ color: accent }}
                >
                  {row.name}
                </span>
                <span className="text-[11px] uppercase tracking-[0.12em] text-faint">
                  {i === 0 ? "sees first" : "then"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function LockedState({ responded }: { responded: number }) {
  const remaining = MIN_OBSERVERS - responded;
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h2 className="mt-2 font-serif text-[clamp(30px,5vw,44px)] font-semibold leading-[1.05]">
        Locked until three respond
      </h2>
      <p className="mt-3 max-w-[560px] text-[15px] text-muted">
        Your comparison opens once at least {MIN_OBSERVERS} people have answered.
        Keeping it closed until then makes the average meaningful and protects
        each observer&rsquo;s anonymity.
      </p>

      <div className="mt-8 flex items-center gap-4">
        <div
          className="h-2.5 w-full max-w-[280px] overflow-hidden rounded-full bg-hair/50"
          role="img"
          aria-label={`${responded} of ${MIN_OBSERVERS} responses received`}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{
              width: `${Math.min(responded / MIN_OBSERVERS, 1) * 100}%`,
            }}
          />
        </div>
        <span className="shrink-0 text-[13px] text-muted">
          {responded} of {MIN_OBSERVERS} in
        </span>
      </div>

      <p className="mt-6 max-w-[560px] text-[15px] text-muted">
        {remaining === 1
          ? "Just one more response and your comparison unlocks."
          : `Send your observer link to a few more people — ${remaining} more responses to go.`}
      </p>

      <Link
        href="/assessment/result"
        className="mt-8 inline-block border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
      >
        Back to your result &amp; share link
      </Link>
    </div>
  );
}
