import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { rankScores } from "@/lib/assessment/ranking";
import type { TribeScore } from "@/lib/assessment/score";
import type { ComparisonRow } from "@/lib/observer/aggregate";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * beside the equal-weight "others" profile, tribe by tribe, with the largest
 * agreements and gaps called out, then an anonymous per-observer drill-down.
 *
 * A pure server component — it renders the already-computed comparison passed in
 * from the report page; no scoring or word→tribe mapping runs here, so nothing
 * crosses the trust boundary (ADR-0009). Observers are identified only by their
 * position ("Observer 1 / 2 / 3"); no identity reaches this view.
 */
export function ComparisonReport({
  rows,
  perObserver,
  observerCount,
}: {
  rows: ComparisonRow[];
  perObserver: TribeScore[][];
  observerCount: number;
}) {
  const highlights = pickHighlights(rows);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Self vs the 360
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        How others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[16px] leading-relaxed text-muted">
        Your own read is set beside the combined read of the{" "}
        <span className="text-ink">{observerCount}</span> people who described
        you. Each observer counts equally, however many words they chose, so no
        single voice drowns out the rest.
      </p>

      {highlights.length > 0 && (
        <section className="mt-12 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where you align &amp; differ
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            {highlights.map((h) => (
              <li
                key={h.key}
                className="flex items-start gap-3 text-[15px] leading-snug"
              >
                <span
                  className="mt-[6px] h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: h.accent }}
                  aria-hidden
                />
                <span className="text-ink">{h.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Tribe-by-tribe: your bar above, the others' bar below, on one shared scale. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-baseline justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Tribe by tribe
          </p>
          <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.12em] text-faint">
            <LegendSwatch label="You" filled />
            <LegendSwatch label="Others" />
          </div>
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
                <span className="font-serif text-[17px] leading-tight">
                  {row.name}
                </span>
                <div className="flex flex-col gap-1.5">
                  <ComparisonBar
                    label="You"
                    relative={row.relativeSelf}
                    hasScore={row.self > 0}
                    accent={accent}
                    filled
                  />
                  <ComparisonBar
                    label="Others"
                    relative={row.relativeOthers}
                    hasScore={row.others > 0}
                    accent={accent}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down — position is the only handle. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each observer, anonymously
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          The tribes each response leaned toward. Responses carry no name,
          relationship, or timestamp &mdash; only the words, so there&rsquo;s no
          way to tell who is who.
        </p>
        <ul className="mt-6 flex flex-col gap-4">
          {perObserver.map((profile, i) => (
            <li
              key={i}
              className="rounded-[2px] border border-hair p-4 max-[520px]:p-3.5"
            >
              <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
                Observer {i + 1}
              </div>
              <ObserverLeanings profile={profile} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** A single labelled bar on the shared comparison scale. */
function ComparisonBar({
  label,
  relative,
  hasScore,
  accent,
  filled = false,
}: {
  label: string;
  relative: number;
  hasScore: boolean;
  accent: string;
  filled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-[46px] shrink-0 text-[10px] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${Math.round(relative * 100)}% of the top score`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(relative * 100, hasScore ? 3 : 0)}%`,
            backgroundColor: accent,
            opacity: filled ? 1 : 0.45,
          }}
        />
      </div>
    </div>
  );
}

/** The top tribes a single anonymous observer leaned toward, as accent chips. */
function ObserverLeanings({ profile }: { profile: TribeScore[] }) {
  const top = rankScores(profile)
    .filter((row) => row.score > 0)
    .slice(0, 3);

  if (top.length === 0) {
    return (
      <p className="mt-2 text-[14px] italic text-faint">No clear leaning.</p>
    );
  }

  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {top.map((row) => {
        const tribe = getTribeBySlug(row.slug);
        const accent = accentHex(tribe?.color ?? "");
        return (
          <li
            key={row.slug}
            className="rounded-[2px] border px-3 py-1 text-[13px] text-ink"
            style={{ borderColor: `${accent}66` }}
          >
            <span
              className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
              style={{ backgroundColor: accent }}
              aria-hidden
            />
            {row.name}
          </li>
        );
      })}
    </ul>
  );
}

function LegendSwatch({
  label,
  filled = false,
}: {
  label: string;
  filled?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-2 w-4 rounded-full bg-ink"
        style={{ opacity: filled ? 1 : 0.4 }}
        aria-hidden
      />
      {label}
    </span>
  );
}

/**
 * Distil the comparison into at most three plain-language callouts: the tribe
 * the Subject and their observers agree on most, and the largest gaps in each
 * direction. Pure — derived entirely from the rows.
 */
interface Highlight {
  key: string;
  text: string;
  accent: string;
}

function pickHighlights(rows: ComparisonRow[]): Highlight[] {
  const accentFor = (slug: string) =>
    accentHex(getTribeBySlug(slug)?.color ?? "");
  const highlights: Highlight[] = [];

  // Strongest agreement: both profiles present, smallest gap, highest floor.
  const shared = rows
    .filter((r) => r.self > 0 && r.others > 0)
    .sort(
      (a, b) =>
        Math.min(b.self, b.others) -
          Math.abs(b.delta) -
          (Math.min(a.self, a.others) - Math.abs(a.delta)),
    );
  if (shared.length > 0) {
    const top = shared[0];
    highlights.push({
      key: `align-${top.slug}`,
      text: `You and your observers agree most on ${top.name}.`,
      accent: accentFor(top.slug),
    });
  }

  // Largest gaps in each direction.
  const seenMore = [...rows]
    .filter((r) => r.delta > 0)
    .sort((a, b) => b.delta - a.delta)[0];
  if (seenMore) {
    highlights.push({
      key: `more-${seenMore.slug}`,
      text: `Others see more ${seenMore.name} in you than you claim for yourself.`,
      accent: accentFor(seenMore.slug),
    });
  }

  const seenLess = [...rows]
    .filter((r) => r.delta < 0)
    .sort((a, b) => a.delta - b.delta)[0];
  if (seenLess && seenLess.slug !== seenMore?.slug) {
    highlights.push({
      key: `less-${seenLess.slug}`,
      text: `You lean into ${seenLess.name} more than your observers do.`,
      accent: accentFor(seenLess.slug),
    });
  }

  return highlights;
}

/**
 * The locked state shown before enough Observers have responded. It reveals
 * nothing about the (few) responses so far — only how many more are needed —
 * and points the Subject back to the share link so they can gather the rest.
 */
export function ObserverReportLocked({
  observerCount,
  threshold,
}: {
  observerCount: number;
  threshold: number;
}) {
  const remaining = Math.max(threshold - observerCount, 0);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Comparison report
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        Not unlocked yet
      </h1>
      <p className="mt-4 max-w-[560px] text-[16px] leading-relaxed text-muted">
        Your comparison opens once at least{" "}
        <span className="text-ink">{threshold}</span> people have described you.
        That keeps the &ldquo;others&rdquo; read meaningful and every response
        anonymous.
      </p>

      <div className="mt-10 rounded-[2px] border border-hair p-6">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] uppercase tracking-[0.14em] text-faint">
            Responses so far
          </span>
          <span className="font-serif text-[22px]">
            {observerCount} / {threshold}
          </span>
        </div>
        <div
          className="mt-4 h-2.5 overflow-hidden rounded-full bg-hair/50"
          role="img"
          aria-label={`${observerCount} of ${threshold} responses received`}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{
              width: `${Math.min((observerCount / threshold) * 100, 100)}%`,
            }}
          />
        </div>
        <p className="mt-4 text-[15px] text-muted">
          {remaining === 1
            ? "Just one more response and your comparison unlocks."
            : `${remaining} more responses and your comparison unlocks.`}
        </p>
      </div>

      <div className="mt-10">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[14px] tracking-[0.06em] text-ink transition-colors hover:text-gold"
        >
          Get your observer link to share →
        </Link>
      </div>
    </div>
  );
}
