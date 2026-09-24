import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import {
  aggregateObservers,
  OBSERVER_UNLOCK_THRESHOLD,
} from "@/lib/observer/aggregate";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * beside the equal-weight "others" profile, so the gap between how you see
 * yourself and how others see you is visible at a glance — "the gap is where
 * growth lives".
 *
 * The report stays locked until at least {@link OBSERVER_UNLOCK_THRESHOLD}
 * Observers have responded, so the average is meaningful and no single Observer
 * is identifiable. Once unlocked it shows self-vs-others bars for all twelve
 * tribes, a plain-language alignment/divergence read, and an anonymous
 * per-observer drill-down (Observer 1 / 2 / 3 …, no attributes).
 *
 * Server component: it imports the `server-only` scoring core and aggregation,
 * so the word→tribe mapping and every score stay off the client (ADR-0009).
 */
export function ComparisonReport({
  selfWords,
  responses,
}: {
  selfWords: string[];
  responses: string[][];
}) {
  const { others, perObserver, observerCount, unlocked } =
    aggregateObservers(responses);

  if (!unlocked) {
    return <LockedState observerCount={observerCount} />;
  }

  const self = score(selfWords);
  const byOthersSlug = new Map(others.map((o) => [o.slug, o.score]));

  // Pair each tribe's self and others score, ranked by the stronger of the two
  // so the tribes that matter to either read surface first. Both inputs are in
  // canonical order, so the stable sort keeps ties deterministic.
  const rows = self
    .map((s) => {
      const othersScore = byOthersSlug.get(s.slug) ?? 0;
      return {
        slug: s.slug,
        name: s.name,
        self: s.score,
        others: othersScore,
        gap: othersScore - s.score,
      };
    })
    .sort((a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others));

  // Scale every bar against the single highest score across both profiles, so
  // the two reads are directly comparable rather than each self-normalized.
  const maxScore = Math.max(
    ...rows.map((r) => Math.max(r.self, r.others)),
    0,
  );

  // Where the two reads most agree on a real strength: the tribe with the
  // highest floor (both see it) — and where they most diverge: the largest gap.
  const alignment = [...rows].sort(
    (a, b) => Math.min(b.self, b.others) - Math.min(a.self, a.others),
  )[0];
  const divergence = [...rows].sort(
    (a, b) => Math.abs(b.gap) - Math.abs(a.gap),
  )[0];

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Self vs. 360
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        How others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Your own read is set beside the average of{" "}
        {observerCount} {observerCount === 1 ? "person" : "people"} who answered
        anonymously. Each observer is weighted equally, so no single voice — or
        anyone who simply picked more words — counts for more.
      </p>

      {(alignment || divergence) && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {alignment && Math.min(alignment.self, alignment.others) > 0 && (
            <Callout
              slug={alignment.slug}
              label="Where you align"
              body={`You and the people who know you both read ${alignment.name} strongly.`}
            />
          )}
          {divergence && Math.abs(divergence.gap) > 0 && (
            <Callout
              slug={divergence.slug}
              label="Where you diverge"
              body={
                divergence.gap > 0
                  ? `Others see more ${divergence.name} in you than you see in yourself.`
                  : `You read yourself as more ${divergence.name} than others do.`
              }
            />
          )}
        </div>
      )}

      {/* Paired self / others bars for all twelve tribes. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-center gap-5 text-[11px] uppercase tracking-[0.16em] text-faint">
          <span className="flex items-center gap-2">
            <LegendSwatch opacity={1} /> You
          </span>
          <span className="flex items-center gap-2">
            <LegendSwatch opacity={0.5} /> Others
          </span>
        </div>
        <ul className="mt-7 flex flex-col gap-6">
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
                <div className="flex flex-col gap-2">
                  <PairBar
                    label="You"
                    value={row.self}
                    max={maxScore}
                    color={accent}
                    solid
                  />
                  <PairBar
                    label="Others"
                    value={row.others}
                    max={maxScore}
                    color={accent}
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
          Each observer&rsquo;s own top tribes, fully anonymous — there&rsquo;s
          no name, order-of-arrival meaning, or any detail tying a column back to
          a person.
        </p>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {perObserver.map((profile, i) => {
            const top = rankScores(profile)
              .filter((t) => t.score > 0)
              .slice(0, 3);
            return (
              <li
                key={i}
                className="rounded-[3px] border border-hair bg-white/40 p-4"
              >
                <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
                  Observer {i + 1}
                </p>
                <ul className="mt-3 flex flex-col gap-2">
                  {top.length === 0 && (
                    <li className="text-[13px] text-muted">No clear read</li>
                  )}
                  {top.map((t) => {
                    const tribe = getTribeBySlug(t.slug);
                    const accent = accentHex(tribe?.color ?? "");
                    return (
                      <li
                        key={t.slug}
                        className="flex items-center gap-2.5 text-[14px]"
                      >
                        <span
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: accent }}
                          aria-hidden
                        />
                        <span className="font-serif">{t.name}</span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function PairBar({
  label,
  value,
  max,
  color,
  solid = false,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  solid?: boolean;
}) {
  const fraction = max > 0 ? value / max : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-[46px] shrink-0 text-[10px] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${Math.round(fraction * 100)}% of the top score`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(fraction * 100, value > 0 ? 3 : 0)}%`,
            backgroundColor: color,
            opacity: solid ? 1 : 0.5,
          }}
        />
      </div>
    </div>
  );
}

function Callout({
  slug,
  label,
  body,
}: {
  slug: string;
  label: string;
  body: string;
}) {
  const tribe = getTribeBySlug(slug);
  const accent = accentHex(tribe?.color ?? "");
  return (
    <div
      className="rounded-[3px] border-l-2 bg-white/40 py-3 pl-4 pr-3"
      style={{ borderColor: accent }}
    >
      <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
        {label}
      </p>
      <p className="mt-1.5 text-[15px] leading-snug text-ink">{body}</p>
    </div>
  );
}

function LegendSwatch({ opacity }: { opacity: number }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full bg-ink"
      style={{ opacity }}
      aria-hidden
    />
  );
}

function LockedState({ observerCount }: { observerCount: number }) {
  const remaining = Math.max(OBSERVER_UNLOCK_THRESHOLD - observerCount, 0);
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Self vs. 360
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        How others see you
      </h1>
      <div className="mt-8 rounded-[3px] border border-hair bg-white/40 p-6">
        <p className="text-[15px] leading-relaxed text-ink">
          This report unlocks once at least{" "}
          <strong className="font-semibold">
            {OBSERVER_UNLOCK_THRESHOLD} people
          </strong>{" "}
          have shared their read of you. So far{" "}
          <strong className="font-semibold">{observerCount}</strong>{" "}
          {observerCount === 1 ? "person has" : "people have"} responded
          {remaining > 0 && (
            <>
              {" "}
              — <strong className="font-semibold">{remaining} more</strong> to
              go
            </>
          )}
          .
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          Waiting for three keeps every observer anonymous and makes the average
          worth trusting. Share your link with a few more people who know you
          well, then check back.
        </p>
        {/* Progress pips — how many of the needed responses are in. */}
        <div className="mt-5 flex items-center gap-2" aria-hidden>
          {Array.from({ length: OBSERVER_UNLOCK_THRESHOLD }).map((_, i) => (
            <span
              key={i}
              className={`h-2 w-8 rounded-full ${
                i < observerCount ? "bg-gold" : "bg-hair"
              }`}
            />
          ))}
          {observerCount > OBSERVER_UNLOCK_THRESHOLD && (
            <span className="text-[12px] text-faint">
              +{observerCount - OBSERVER_UNLOCK_THRESHOLD}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
