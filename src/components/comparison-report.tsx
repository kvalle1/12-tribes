import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import {
  OBSERVER_UNLOCK_THRESHOLD,
  aggregateObservers,
  observersUnlocked,
  scorePerObserver,
} from "@/lib/observer/aggregate";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * beside the equal-weight "others" profile, with the gaps — where others see
 * more or less than the Subject does of themselves — called out, plus an
 * anonymous per-observer drill-down. It unlocks only once at least
 * `OBSERVER_UNLOCK_THRESHOLD` observers have responded; before that it renders a
 * locked state so the report (and each observer's anonymity) stays meaningful.
 *
 * Server component: it imports the scoring core and the aggregation, both
 * `server-only`, so the word→tribe mapping never reaches the client — only the
 * computed scores are rendered (ADR-0009). The per-observer drill-down is a
 * native `<details>` disclosure, so no client JavaScript is needed.
 */

/**
 * How far the "others" score may sit from the "self" score before a tribe is
 * called a divergence rather than aligned. A gap on the normalized 0–1 scale;
 * deliberately modest and tunable — the point is to surface the handful of
 * tribes where the two reads genuinely part ways.
 */
const DIVERGENCE_THRESHOLD = 0.08;

interface ComparisonRow {
  slug: string;
  name: string;
  self: number;
  others: number;
}

type Divergence = "others-more" | "self-more" | "aligned";

function divergenceOf(row: ComparisonRow): Divergence {
  const gap = row.others - row.self;
  if (gap >= DIVERGENCE_THRESHOLD) return "others-more";
  if (-gap >= DIVERGENCE_THRESHOLD) return "self-more";
  return "aligned";
}

const DIVERGENCE_LABEL: Record<Divergence, string> = {
  "others-more": "Others see more",
  "self-more": "You see more",
  aligned: "Aligned",
};

/**
 * Order two observer profiles by content alone — descending by each tribe's
 * score in canonical order. Purely deterministic and carries no response-time
 * signal, so it can order the anonymous drill-down without re-exposing who
 * responded when. Both tables are the canonical 12-tribe order from `score`.
 */
function compareProfiles(a: TribeScore[], b: TribeScore[]): number {
  for (let i = 0; i < a.length; i++) {
    if (b[i].score !== a[i].score) return b[i].score - a[i].score;
  }
  return 0;
}

export function ComparisonReport({
  selfWords,
  observerSelections,
}: {
  selfWords: string[];
  observerSelections: string[][];
}) {
  const observerCount = observerSelections.length;

  if (!observersUnlocked(observerCount)) {
    return <LockedState observerCount={observerCount} />;
  }

  const self = score(selfWords);
  const others = aggregateObservers(observerSelections);
  const perObserver = scorePerObserver(observerSelections);

  const selfBySlug = new Map(self.map((s) => [s.slug, s.score]));
  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));

  // One row per tribe, ordered by the stronger of the two reads so the tribes
  // that matter to either side surface first. Array sort is stable, so ties
  // keep canonical (tribe `number`) order.
  const rows: ComparisonRow[] = self
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      self: selfBySlug.get(s.slug) ?? 0,
      others: othersBySlug.get(s.slug) ?? 0,
    }))
    .sort((a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others));

  // Shared scale across both profiles so the two bars are directly comparable.
  // `|| 1` only guards the all-zero case (no selected words anywhere), so the
  // bars render at 0 width rather than dividing by zero.
  const maxScore =
    Math.max(0, ...rows.flatMap((r) => [r.self, r.others])) || 1;

  // Order the drill-down by each observer's own profile content, never by when
  // they responded — chronological order would let a Subject who knows roughly
  // when each person answered map "Observer N" back to a person, undercutting
  // the anonymity ADR-0003 exists to protect. Observers with identical reads
  // are indistinguishable anyway.
  const drillDown = [...perObserver].sort(compareProfiles);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,5vw,48px)] font-semibold leading-[1.05]">
        How others see you
      </h1>
      <p className="mt-3 max-w-[560px] text-[15px] text-muted">
        Your own read sits beside the combined read of your{" "}
        {observerCount} observers. Each observer is scored on their own and then
        averaged with equal weight, so no single person counts for more. The gap
        is where growth lives.
      </p>

      {/* Legend */}
      <div className="mt-8 flex flex-wrap items-center gap-6 text-[12px] text-muted">
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-6 rounded-full"
            style={{ backgroundColor: "var(--ink)", opacity: 0.45 }}
            aria-hidden
          />
          You
        </span>
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-6 rounded-full bg-gold"
            aria-hidden
          />
          Others
        </span>
      </div>

      {/* Self vs others, per tribe. */}
      <section className="mt-8 border-t border-hair pt-8">
        <ul className="flex flex-col gap-6">
          {rows.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            const divergence = divergenceOf(row);
            return (
              <li key={row.slug} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-serif text-[17px] leading-none">
                    {row.name}
                  </span>
                  <span
                    className="text-[10px] uppercase tracking-[0.14em] text-faint"
                    data-divergence={divergence}
                    style={
                      divergence !== "aligned"
                        ? { color: accent }
                        : undefined
                    }
                  >
                    {DIVERGENCE_LABEL[divergence]}
                  </span>
                </div>
                <Bar
                  label={`You: ${row.name} at ${Math.round((row.self / maxScore) * 100)}% of the strongest score shown`}
                  fraction={row.self / maxScore}
                  color="var(--ink)"
                  opacity={0.4}
                  positive={row.self > 0}
                />
                <Bar
                  label={`Others: ${row.name} at ${Math.round((row.others / maxScore) * 100)}% of the strongest score shown`}
                  fraction={row.others / maxScore}
                  color={accent}
                  opacity={0.9}
                  positive={row.others > 0}
                />
              </li>
            );
          })}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <details className="group">
          <summary className="cursor-pointer list-none text-[12px] uppercase tracking-[0.2em] text-faint transition-colors hover:text-ink">
            <span className="group-open:hidden">Show each observer ▾</span>
            <span className="hidden group-open:inline">Hide observers ▴</span>
          </summary>
          <p className="mt-3 max-w-[520px] text-[14px] text-muted">
            Each observer, fully anonymous — no names, no relationships — with
            the tribes they most saw in you.
          </p>
          <ul className="mt-6 flex flex-col gap-6">
            {drillDown.map((profile, index) => (
              <ObserverCard
                key={index}
                index={index + 1}
                profile={profile}
              />
            ))}
          </ul>
        </details>
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

function Bar({
  label,
  fraction,
  color,
  opacity,
  positive,
}: {
  label: string;
  fraction: number;
  color: string;
  opacity: number;
  positive: boolean;
}) {
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${Math.max(fraction * 100, positive ? 3 : 0)}%`,
          backgroundColor: color,
          opacity,
        }}
      />
    </div>
  );
}

function ObserverCard({
  index,
  profile,
}: {
  index: number;
  profile: TribeScore[];
}) {
  const top = rankScores(profile)
    .filter((row) => row.score > 0)
    .slice(0, 3);

  return (
    <li className="rounded-[2px] border border-hair bg-stone/40 px-5 py-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-faint">
        Observer {index}
      </p>
      {top.length === 0 ? (
        <p className="mt-2 text-[14px] text-muted">No clear read.</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2.5">
          {top.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li
                key={row.slug}
                className="rounded-[2px] border px-3 py-1 text-[13px] text-ink"
                style={{ borderColor: accent }}
              >
                {row.name}
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function LockedState({ observerCount }: { observerCount: number }) {
  const remaining = OBSERVER_UNLOCK_THRESHOLD - observerCount;
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,5vw,48px)] font-semibold leading-[1.05]">
        Locked until {OBSERVER_UNLOCK_THRESHOLD} people respond
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        {observerCount === 0
          ? "No one has responded yet."
          : observerCount === 1
            ? "One person has responded so far."
            : `${observerCount} people have responded so far.`}{" "}
        The comparison unlocks once at least {OBSERVER_UNLOCK_THRESHOLD} have — enough
        to make the combined read meaningful and to keep each response
        anonymous.
      </p>

      <div
        className="mt-10 h-2.5 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${observerCount} of ${OBSERVER_UNLOCK_THRESHOLD} responses in`}
      >
        <div
          className="h-full rounded-full bg-gold transition-[width]"
          style={{
            width: `${Math.min(observerCount / OBSERVER_UNLOCK_THRESHOLD, 1) * 100}%`,
          }}
        />
      </div>
      <p className="mt-3 text-[12px] uppercase tracking-[0.14em] text-faint">
        {observerCount} of {OBSERVER_UNLOCK_THRESHOLD} ·{" "}
        {remaining} more to unlock
      </p>

      <div className="mt-12 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
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
