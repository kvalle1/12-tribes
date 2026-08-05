import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import {
  aggregateObservers,
  compareProfiles,
  type ProfileComparison,
} from "@/lib/assessment/aggregate-observers";
import { MIN_OBSERVERS_FOR_REPORT } from "@/lib/observer/constants";
import { cn } from "@/lib/utils";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * beside the equal-weight "how others see you" profile, the tribes where the two
 * views diverge, and an anonymous per-observer drill-down.
 *
 * Locked until at least `MIN_OBSERVERS_FOR_REPORT` Observers have responded —
 * the floor that makes the average meaningful and keeps individual Observers
 * un-single-out-able. Before then it renders a clear locked state with progress.
 *
 * A server component: it imports the `server-only` scoring core, so the
 * word→tribe mapping never reaches the client. The per-observer drill-down shows
 * only "Observer 1 / 2 / 3 …" and their top tribes — never a name, a
 * relationship, a word count, or anything that could identify who answered.
 */

/** The 0–1 gap beyond which a tribe counts as a notable divergence. */
const DIVERGENCE_THRESHOLD = 0.15;

export function ObserverComparison({
  selfWords,
  observerResponses,
}: {
  selfWords: string[];
  observerResponses: string[][];
}) {
  const count = observerResponses.length;

  if (count < MIN_OBSERVERS_FOR_REPORT) {
    return <LockedState count={count} />;
  }

  const comparison = compareProfiles(
    score(selfWords),
    aggregateObservers(observerResponses),
  );

  // Both profiles are on the same 0–1 scale; scale every bar to the single
  // largest value across both so "You" and "Others" bars are directly comparable.
  const scaleMax = Math.max(
    ...comparison.flatMap((c) => [c.self, c.others]),
    0,
  );

  const notable = comparison
    .filter((c) => Math.abs(c.divergence) >= DIVERGENCE_THRESHOLD)
    .sort((a, b) => Math.abs(b.divergence) - Math.abs(a.divergence))
    .slice(0, 3);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h2 className="mt-2 font-serif text-[clamp(28px,5vw,40px)] font-semibold leading-[1.05]">
        You, and how others see you
      </h2>
      <p className="mt-3 max-w-[540px] text-[15px] text-muted">
        Your own selection sits beside the combined read from{" "}
        {count} {count === 1 ? "person" : "people"} who described you. Each
        Observer counts equally, however many words they picked.
      </p>

      {/* Self vs others, tribe by tribe, both bars on one shared scale. */}
      <section className="mt-12 border-t border-hair pt-8">
        <div className="flex items-center gap-5 text-[11px] uppercase tracking-[0.14em] text-faint">
          <LegendSwatch label="You" filled />
          <LegendSwatch label="Others" />
        </div>
        <ul className="mt-6 flex flex-col gap-5">
          {comparison.map((row) => (
            <ComparisonRow key={row.slug} row={row} scaleMax={scaleMax} />
          ))}
        </ul>
      </section>

      {/* Where the two views align or diverge — the gap is where growth lives. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Where you and others {notable.length > 0 ? "diverge" : "align"}
        </p>
        {notable.length > 0 ? (
          <ul className="mt-5 flex flex-col gap-3">
            {notable.map((c) => (
              <li key={c.slug} className="text-[15px] text-ink">
                <span
                  className="font-serif text-[17px]"
                  style={{ color: accentHex(getTribeBySlug(c.slug)?.color ?? "") }}
                >
                  {c.name}
                </span>{" "}
                <span className="text-muted">
                  {c.divergence > 0
                    ? "— others see more of this in you than you do."
                    : "— you lean into this more than others see."}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 max-w-[520px] text-[15px] text-muted">
            Your self-view and how others see you line up closely — no tribe
            stands out as a blind spot.
          </p>
        )}
      </section>

      {/* Anonymous per-observer drill-down: Observer N and their top tribes only. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Each response is fully anonymous — no names, no relationships, just the
          spread of how you came across.
        </p>
        <ul className="mt-6 flex flex-col gap-5">
          {observerResponses.map((words, i) => (
            <ObserverRow key={i} index={i} words={words} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function ComparisonRow({
  row,
  scaleMax,
}: {
  row: ProfileComparison;
  scaleMax: number;
}) {
  const tribe = getTribeBySlug(row.slug);
  const accent = accentHex(tribe?.color ?? "");
  const selfPct = scaleMax > 0 ? (row.self / scaleMax) * 100 : 0;
  const othersPct = scaleMax > 0 ? (row.others / scaleMax) * 100 : 0;

  return (
    <li className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]">
      <span className="font-serif text-[17px] leading-tight">{row.name}</span>
      <div className="flex flex-col gap-1.5">
        <Bar
          label="You"
          pct={selfPct}
          hasScore={row.self > 0}
          accent={accent}
          filled
        />
        <Bar
          label="Others"
          pct={othersPct}
          hasScore={row.others > 0}
          accent={accent}
        />
      </div>
    </li>
  );
}

function Bar({
  label,
  pct,
  hasScore,
  accent,
  filled = false,
}: {
  label: string;
  pct: number;
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
        aria-label={`${label}: ${Math.round(pct)}% of the top score`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(pct, hasScore ? 3 : 0)}%`,
            backgroundColor: accent,
            opacity: filled ? 1 : 0.4,
          }}
        />
      </div>
    </div>
  );
}

function ObserverRow({ index, words }: { index: number; words: string[] }) {
  const top = rankScores(score(words))
    .filter((t) => t.score > 0)
    .slice(0, 3);

  return (
    <li>
      <div className="text-[13px] uppercase tracking-[0.14em] text-muted">
        Observer {index + 1}
      </div>
      <ul className="mt-2 flex flex-wrap gap-2.5">
        {top.map((t) => {
          const accent = accentHex(getTribeBySlug(t.slug)?.color ?? "");
          return (
            <li
              key={t.slug}
              className="rounded-[2px] border px-3 py-1 text-[14px] text-ink"
              style={{ borderColor: accent, backgroundColor: `${accent}14` }}
            >
              {t.name}
            </li>
          );
        })}
      </ul>
    </li>
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
    <span className="flex items-center gap-2">
      <span
        className="h-2.5 w-6 rounded-full bg-ink"
        style={{ opacity: filled ? 1 : 0.4 }}
        aria-hidden
      />
      {label}
    </span>
  );
}

function LockedState({ count }: { count: number }) {
  const remaining = MIN_OBSERVERS_FOR_REPORT - count;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h2 className="mt-2 font-serif text-[clamp(28px,5vw,40px)] font-semibold leading-[1.05]">
        Locked until three respond
      </h2>
      <p className="mt-3 max-w-[540px] text-[15px] text-muted">
        Your comparison report opens once at least{" "}
        {MIN_OBSERVERS_FOR_REPORT} people have described you. Keeping it locked
        until then makes the &ldquo;others&rdquo; read meaningful and keeps every
        Observer anonymous.
      </p>

      <div className="mt-8 rounded-[2px] border border-hair p-6">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] uppercase tracking-[0.16em] text-faint">
            Responses so far
          </span>
          <span className="font-serif text-[18px]">
            {count} of {MIN_OBSERVERS_FOR_REPORT}
          </span>
        </div>
        <div
          className="mt-4 flex gap-2"
          role="img"
          aria-label={`${count} of ${MIN_OBSERVERS_FOR_REPORT} Observers have responded`}
        >
          {Array.from({ length: MIN_OBSERVERS_FOR_REPORT }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-2.5 flex-1 rounded-full",
                i < count ? "bg-gold" : "bg-hair",
              )}
            />
          ))}
        </div>
        <p className="mt-5 text-[14px] text-muted">
          {remaining === 1
            ? "Just one more response to go."
            : `${remaining} more responses to go.`}
        </p>
      </div>
    </div>
  );
}
