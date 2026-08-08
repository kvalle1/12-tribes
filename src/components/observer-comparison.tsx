import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { rankScores } from "@/lib/assessment/ranking";
import type { TribeScore } from "@/lib/assessment/score";
import {
  MIN_OBSERVERS_TO_UNLOCK,
  isObserverReportUnlocked,
  type ObserverAggregate,
} from "@/lib/observer/aggregate";
import { cn } from "@/lib/utils";

/**
 * The self-vs-others comparison report (issue #9, ADR-0003) — the tail of the
 * Subject's 360 loop. Until at least three Observers have responded it renders a
 * locked state with progress; once unlocked it shows the Subject's own profile
 * beside the equal-weight "others" average, calls out where the two agree and
 * diverge, and offers an anonymous per-observer drill-down.
 *
 * It's presentational: the scoring and the equal-weight aggregation happen
 * server-side (`aggregateObservers`, `server-only`) and arrive here as plain
 * numbers, so this component pulls in no scoring logic or observer identity.
 */
export function ObserverComparison({
  selfScores,
  aggregate,
}: {
  selfScores: TribeScore[];
  aggregate: ObserverAggregate;
}) {
  if (!isObserverReportUnlocked(aggregate.observerCount)) {
    return <LockedState count={aggregate.observerCount} />;
  }
  return <ComparisonReport selfScores={selfScores} aggregate={aggregate} />;
}

/**
 * Shown before the report unlocks: how many of the three needed responses are
 * in, and how many are left, with a small progress meter.
 */
function LockedState({ count }: { count: number }) {
  const remaining = MIN_OBSERVERS_TO_UNLOCK - count;
  return (
    <div className="mt-8 rounded-[2px] border border-dashed border-hair p-6">
      <p className="text-[11px] uppercase tracking-[0.18em] text-faint">
        Comparison locked
      </p>
      <p className="mt-3 text-[15px] text-muted">
        {count === 0
          ? "No responses yet."
          : `${count} of ${MIN_OBSERVERS_TO_UNLOCK} responses in.`}{" "}
        {remaining === 1
          ? "One more and your comparison unlocks."
          : `${remaining} more and your comparison unlocks.`}
      </p>
      <div
        className="mt-4 flex gap-1.5"
        role="img"
        aria-label={`${count} of ${MIN_OBSERVERS_TO_UNLOCK} observer responses received`}
      >
        {Array.from({ length: MIN_OBSERVERS_TO_UNLOCK }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              i < count ? "bg-gold" : "bg-hair",
            )}
          />
        ))}
      </div>
    </div>
  );
}

interface ComparedTribe {
  slug: string;
  name: string;
  self: number;
  others: number;
}

/**
 * The unlocked report: self vs the equal-weight others average, side by side.
 */
function ComparisonReport({
  selfScores,
  aggregate,
}: {
  selfScores: TribeScore[];
  aggregate: ObserverAggregate;
}) {
  const othersBySlug = new Map(
    aggregate.average.map((s) => [s.slug, s.score] as const),
  );

  const rows: ComparedTribe[] = selfScores
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      self: s.score,
      others: othersBySlug.get(s.slug) ?? 0,
    }))
    // Lead with the tribes that matter most to either read.
    .sort((a, b) => b.self + b.others - (a.self + a.others));

  // A common scale for both bars so a gap is read honestly as a real difference.
  const maxScore = Math.max(
    ...rows.map((r) => Math.max(r.self, r.others)),
    0.0001,
  );

  const scored = rows.filter((r) => r.self > 0 || r.others > 0);
  const divergent = mostDivergent(scored);
  const aligned = mostAligned(scored);

  return (
    <div className="mt-8">
      <p className="text-[11px] uppercase tracking-[0.18em] text-faint">
        Self vs others
      </p>
      <p className="mt-2 max-w-[520px] text-[15px] text-muted">
        Your own read alongside the equal-weight average of the{" "}
        {aggregate.observerCount} people who answered — every Observer counts the
        same, no matter how many words they picked.
      </p>

      <div className="mt-5 flex items-center gap-5 text-[11px] uppercase tracking-[0.14em] text-faint">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-ink" />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full border border-gold bg-gold/30" />
          Others
        </span>
      </div>

      <ul className="mt-5 flex flex-col gap-4">
        {rows.map((row) => {
          const tribe = getTribeBySlug(row.slug);
          const accent = accentHex(tribe?.color ?? "");
          return (
            <li
              key={row.slug}
              className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
            >
              <span className="font-serif text-[16px] leading-tight">
                {row.name}
              </span>
              <div className="flex flex-col gap-1.5">
                <CompareBar
                  label={`${row.name}, your read`}
                  value={row.self}
                  max={maxScore}
                  color="var(--ink)"
                  filled
                />
                <CompareBar
                  label={`${row.name}, others' read`}
                  value={row.others}
                  max={maxScore}
                  color={accent}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {(aligned || divergent) && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {aligned && (
            <Callout
              eyebrow="Where you align"
              body={`You and your observers both land on ${aligned.name}.`}
            />
          )}
          {divergent && (
            <Callout
              eyebrow="Where you differ"
              body={
                divergent.self > divergent.others
                  ? `You read yourself as ${divergent.name} more strongly than others do.`
                  : `Others see more ${divergent.name} in you than you do yourself.`
              }
            />
          )}
        </div>
      )}

      <ObserverDrilldown observers={aggregate.observers} />
    </div>
  );
}

/** A single thin bar for one profile's score on one tribe. */
function CompareBar({
  label,
  value,
  max,
  color,
  filled = false,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  filled?: boolean;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={`${label}: ${Math.round((value / max) * 100)}`}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${value > 0 ? Math.max(pct, 3) : 0}%`,
          backgroundColor: color,
          opacity: filled ? 1 : 0.5,
        }}
      />
    </div>
  );
}

function Callout({ eyebrow, body }: { eyebrow: string; body: string }) {
  return (
    <div className="rounded-[2px] border border-hair p-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
        {eyebrow}
      </p>
      <p className="mt-2 text-[14px] text-ink">{body}</p>
    </div>
  );
}

/**
 * The anonymous per-observer drill-down: each Observer's top tribes, labelled
 * only "Observer 1/2/3…" with no attributes — the anonymity the 360 flow
 * promises so people answer candidly (ADR-0003).
 */
function ObserverDrilldown({ observers }: { observers: TribeScore[][] }) {
  return (
    <section className="mt-10 border-t border-hair pt-8">
      <p className="text-[11px] uppercase tracking-[0.18em] text-faint">
        Response by response
      </p>
      <p className="mt-2 text-[14px] text-muted">
        Each response stays anonymous — no names, no attributes, just how they
        read you.
      </p>
      <ul className="mt-5 flex flex-col gap-3">
        {observers.map((profile, i) => {
          const top = rankScores(profile)
            .filter((t) => t.score > 0)
            .slice(0, 3);
          return (
            <li
              key={i}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5"
            >
              <span className="text-[12px] uppercase tracking-[0.14em] text-faint">
                Observer {i + 1}
              </span>
              {top.length === 0 ? (
                <span className="text-[14px] text-muted">No clear signal</span>
              ) : (
                <span className="flex flex-wrap gap-2">
                  {top.map((t) => {
                    const tribe = getTribeBySlug(t.slug);
                    const accent = accentHex(tribe?.color ?? "");
                    return (
                      <span
                        key={t.slug}
                        className="rounded-[2px] border px-2.5 py-1 text-[13px] text-ink"
                        style={{ borderColor: accent, backgroundColor: `${accent}1a` }}
                      >
                        {t.name}
                      </span>
                    );
                  })}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The scored tribe with the widest self↔others gap, or null if none scored. */
function mostDivergent(rows: ComparedTribe[]): ComparedTribe | null {
  let best: ComparedTribe | null = null;
  let bestGap = 0;
  for (const row of rows) {
    const gap = Math.abs(row.self - row.others);
    if (gap > bestGap) {
      bestGap = gap;
      best = row;
    }
  }
  return bestGap > 0 ? best : null;
}

/**
 * The tribe both reads land on most: the highest combined score among tribes
 * where self and others are close (a small gap relative to the signal).
 */
function mostAligned(rows: ComparedTribe[]): ComparedTribe | null {
  let best: ComparedTribe | null = null;
  let bestCombined = 0;
  for (const row of rows) {
    const combined = row.self + row.others;
    const gap = Math.abs(row.self - row.others);
    // "Close" = the gap is under a third of the combined signal.
    if (combined > 0 && gap <= combined / 3 && combined > bestCombined) {
      bestCombined = combined;
      best = row;
    }
  }
  return best;
}
