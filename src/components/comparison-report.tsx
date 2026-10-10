import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { deriveResult, score } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import { aggregateObservers } from "@/lib/observer/aggregate";
import { buildComparison, type ComparisonRow } from "@/lib/observer/comparison";
import type { StoredObserverResponse } from "@/lib/observer/repository";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * beside the equal-weight aggregated "others" profile, the tribes where the two
 * reads diverge most, and an anonymous per-observer drill-down.
 *
 * Server component — it imports the scoring core and the observer aggregation,
 * both `server-only`, so the word→tribe mapping never reaches the client
 * (ADR-0009). The observers' raw words are scored here on the server and only
 * tribe scores are rendered; no observer identity exists to leak.
 *
 * Render this only once at least `OBSERVER_UNLOCK_THRESHOLD` observers have
 * responded — the page owns the locked state shown before then.
 */
export function ComparisonReport({
  selfWords,
  observerResponses,
}: {
  selfWords: string[];
  observerResponses: StoredObserverResponse[];
}) {
  const selfScores = score(selfWords);
  const othersScores = aggregateObservers(observerResponses);
  const rows = buildComparison(selfScores, othersScores);

  const selfPrimary = deriveResult(selfScores).primary;
  const othersRanked = rankScores(othersScores);
  const othersTop = othersRanked[0];
  // "Agree" is tie-aware: the two reads align when the Subject's Primary sits
  // among the observers' tied-top tribes, not only when it is the single first
  // row (a top tie broken by canonical order could otherwise mislabel the lead).
  const othersTopScore = othersTop?.score ?? 0;
  const agree =
    othersTopScore > 0 &&
    othersRanked.some(
      (tribe) =>
        tribe.slug === selfPrimary.slug &&
        Math.abs(tribe.score - othersTopScore) < TIE_EPSILON,
    );

  // The biggest gaps between the two reads — where the 360 insight lives. Keep
  // only differences large enough to be worth naming.
  const divergences = [...rows]
    .filter((row) => Math.abs(row.gap) >= DIVERGENCE_THRESHOLD)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 3);

  // Each observer's own top tribes. Ordered by content (their top-tribe slugs),
  // deliberately *not* by submission time — so the "Observer 1/2/3" labels carry
  // no arrival-order signal a Subject could use to attribute a read to a person
  // (ADR-0003 anonymity). Averaging in `aggregateObservers` is order-independent,
  // so this ordering is purely presentational.
  const perObserver = observerResponses
    .map((response) =>
      rankScores(score(response.words))
        .filter((tribe) => tribe.score > 0)
        .slice(0, 3),
    )
    .sort((a, b) =>
      a
        .map((t) => t.slug)
        .join(",")
        .localeCompare(b.map((t) => t.slug).join(",")),
    );

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.05]">
        How others see you
      </h1>

      {/* Headline: do your own read and the aggregate agree? */}
      <p className="mt-5 max-w-[560px] text-[16px] leading-relaxed text-muted">
        {agree ? (
          <>
            You and the people around you lead with the same tribe —{" "}
            <PrimaryName slug={selfPrimary.slug} />. Where the bars part ways
            below is where their read adds to your own.
          </>
        ) : (
          <>
            You lead with <PrimaryName slug={selfPrimary.slug} />; the people
            around you lead with{" "}
            <PrimaryName slug={othersTop?.slug ?? selfPrimary.slug} />. The gap
            between the two reads is where the most useful insight lives.
          </>
        )}
      </p>

      {/* Self vs others, tribe by tribe, on a shared scale. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-baseline justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            You vs. them
          </p>
          <p className="flex items-center gap-4 text-[11px] uppercase tracking-[0.14em] text-faint">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-3 rounded-full bg-ink" />
              You
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-3 rounded-full bg-ink/30" />
              Others
            </span>
          </p>
        </div>

        <ul className="mt-6 flex flex-col gap-5">
          {rows.map((row) => (
            <ComparisonBars key={row.slug} row={row} />
          ))}
        </ul>
      </section>

      {/* Where the two reads diverge most. */}
      {divergences.length > 0 && (
        <section className="mt-14 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where your reads differ most
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            {divergences.map((row) => (
              <li
                key={row.slug}
                className="flex items-baseline gap-3 text-[15px] text-ink"
              >
                <span
                  className="mt-[7px] inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: accentHex(tribeColor(row.slug)) }}
                  aria-hidden
                />
                <span>
                  {row.gap > 0 ? (
                    <>
                      Others see more{" "}
                      <span className="font-serif text-[16px]">{row.name}</span>{" "}
                      in you than you see in yourself.
                    </>
                  ) : (
                    <>
                      You lean{" "}
                      <span className="font-serif text-[16px]">{row.name}</span>{" "}
                      more than the people around you do.
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each voice, anonymously
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          The spread of opinion, one observer at a time. Responses are fully
          anonymous — no name, no relationship, nothing that ties a read back to
          a person.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4 max-[520px]:grid-cols-1">
          {perObserver.map((top, index) => (
            <div
              key={index}
              className="rounded-[3px] border border-hair bg-white/60 p-5"
            >
              <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
                Observer {index + 1}
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {top.map((tribe) => (
                  <li
                    key={tribe.slug}
                    className="flex items-center gap-2 text-[15px] text-ink"
                  >
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: accentHex(tribeColor(tribe.slug)),
                      }}
                      aria-hidden
                    />
                    <span className="font-serif text-[16px]">{tribe.name}</span>
                  </li>
                ))}
                {top.length === 0 && (
                  <li className="text-[14px] text-faint">No clear lean.</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-14 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Back to your result
        </Link>
        <Link
          href={`/tribes/${selfPrimary.slug}`}
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Read the full {selfPrimary.name} profile
        </Link>
      </div>
    </div>
  );
}

/** Minimum absolute gap (on the 0–1 normalized scale) worth calling out. */
const DIVERGENCE_THRESHOLD = 0.08;

/** Scores within this of the top are treated as tied for the lead. */
const TIE_EPSILON = 1e-9;

function tribeColor(slug: string): string {
  return getTribeBySlug(slug)?.color ?? "";
}

function PrimaryName({ slug }: { slug: string }) {
  const tribe = getTribeBySlug(slug);
  if (!tribe) return null;
  return (
    <span className="font-serif" style={{ color: accentHex(tribe.color) }}>
      {tribe.name}
    </span>
  );
}

/** One tribe's paired You/Others bars, scaled against the shared maximum. */
function ComparisonBars({ row }: { row: ComparisonRow }) {
  const accent = accentHex(tribeColor(row.slug));

  return (
    <li className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]">
      <span
        className="font-serif text-[17px] leading-tight"
        style={{ color: accent }}
      >
        {row.name}
      </span>
      <div className="flex flex-col gap-1.5">
        <Bar
          label="You"
          relative={row.selfRelative}
          score={row.selfScore}
          color={accent}
          strong
        />
        <Bar
          label="Others"
          relative={row.othersRelative}
          score={row.othersScore}
          color={accent}
        />
      </div>
    </li>
  );
}

function Bar({
  label,
  relative,
  score: rawScore,
  color,
  strong = false,
}: {
  label: string;
  relative: number;
  score: number;
  color: string;
  strong?: boolean;
}) {
  const percent = Math.round(rawScore * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="w-[42px] shrink-0 text-[10px] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${percent}%`}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(relative * 100, rawScore > 0 ? 3 : 0)}%`,
            backgroundColor: color,
            opacity: strong ? 1 : 0.4,
          }}
        />
      </div>
      <span className="w-[38px] shrink-0 text-right text-[11px] tabular-nums text-muted">
        {percent}%
      </span>
    </div>
  );
}
