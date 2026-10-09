import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import { aggregateObservers } from "@/lib/observer/aggregate";
import {
  compareProfiles,
  divergences,
  type ComparisonRow,
} from "@/lib/observer/comparison";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * beside the equal-weight "others" profile, the tribes where the two reads
 * diverge most, and an anonymous per-observer drill-down.
 *
 * A server component — it reuses the scoring core, which is `server-only` so the
 * word→tribe mapping never reaches the client (ADR-0009). All scoring happens
 * here; the drill-down expands with a native `<details>` element, so the view
 * stays fully server-rendered with no client JavaScript.
 *
 * The caller is responsible for the unlock gate: this renders only once at least
 * `OBSERVER_UNLOCK_THRESHOLD` observers have responded.
 */
export function ComparisonReport({
  selfWords,
  observerWordLists,
}: {
  selfWords: string[];
  observerWordLists: string[][];
}) {
  const selfScores = score(selfWords);
  const othersScores = aggregateObservers(
    observerWordLists.map((words) => ({ words })),
  );
  const rows = compareProfiles(selfScores, othersScores);
  const topDivergences = divergences(rows, 3);

  // Order the side-by-side bars by the strongest combined signal so the tribes
  // that matter sit at the top; ties keep canonical order (compareProfiles is
  // already canonical, and sort is stable).
  const ordered = [...rows].sort(
    (a, b) => b.self + b.others - (a.self + a.others),
  );

  // Both the "you" and "others" bars share one scale — the largest score in
  // either profile — so a longer bar always means a higher score, and self and
  // others are read against each other rather than each self-normalized.
  const scaleMax = Math.max(
    ...rows.map((row) => Math.max(row.self, row.others)),
    0,
  );

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        How others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Your own read sits beside the combined read of the{" "}
        {observerWordLists.length} people who responded. Each observer is scored
        on their own and then averaged equally, so no single voice — or a longer
        list of words — counts for more.
      </p>

      {/* Where the two reads diverge most — "the gap is where growth lives". */}
      {topDivergences.length > 0 && (
        <section className="mt-12 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where your reads diverge
          </p>
          <ul className="mt-6 flex flex-col gap-4">
            {topDivergences.map((row) => {
              const accent = accentHex(getTribeBySlug(row.slug)?.color ?? "");
              return (
                <li key={row.slug} className="flex items-start gap-3">
                  <span
                    className="mt-[6px] inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: accent }}
                    aria-hidden
                  />
                  <p className="text-[15px] leading-snug text-ink">
                    {row.direction === "others-higher" ? (
                      <>
                        Others see more{" "}
                        <span className="font-serif" style={{ color: accent }}>
                          {row.name}
                        </span>{" "}
                        in you than you see in yourself.
                      </>
                    ) : (
                      <>
                        You see more{" "}
                        <span className="font-serif" style={{ color: accent }}>
                          {row.name}
                        </span>{" "}
                        in yourself than others do.
                      </>
                    )}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Self vs. others, tribe by tribe, on a shared scale. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            You vs. others
          </p>
          <Legend />
        </div>
        <ul className="mt-6 flex flex-col gap-5">
          {ordered.map((row) => (
            <CompareRow key={row.slug} row={row} scaleMax={scaleMax} />
          ))}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down (Observer 1/2/3 — no attributes). */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each observer, anonymously
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          The individual reads behind the average. They carry no names or
          labels — only the order they arrived in.
        </p>
        <ul className="mt-6 flex flex-col gap-2.5">
          {observerWordLists.map((words, index) => (
            <ObserverDetail
              key={index}
              label={`Observer ${index + 1}`}
              words={words}
            />
          ))}
        </ul>
      </section>

      {/* Actions. */}
      <div className="mt-14 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
        <a
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          ← Back to your result
        </a>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.14em] text-faint">
      <span className="flex items-center gap-1.5">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full bg-gold"
          aria-hidden
        />
        You
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full bg-ink"
          aria-hidden
        />
        Others
      </span>
    </div>
  );
}

function CompareRow({
  row,
  scaleMax,
}: {
  row: ComparisonRow;
  scaleMax: number;
}) {
  const width = (value: number) =>
    scaleMax > 0 ? Math.max((value / scaleMax) * 100, value > 0 ? 3 : 0) : 0;

  return (
    <li className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]">
      <span className="font-serif text-[16px] leading-tight">{row.name}</span>
      <div className="flex flex-col gap-1.5">
        <Bar
          label={`You: ${pct(row.self)}%`}
          width={width(row.self)}
          className="bg-gold"
        />
        <Bar
          label={`Others: ${pct(row.others)}%`}
          width={width(row.others)}
          className="bg-ink"
        />
      </div>
    </li>
  );
}

function Bar({
  label,
  width,
  className,
}: {
  label: string;
  width: number;
  className: string;
}) {
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={label}
    >
      <div
        className={`h-full rounded-full ${className}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function ObserverDetail({ label, words }: { label: string; words: string[] }) {
  const top = rankScores(score(words))
    .filter((row) => row.score > 0)
    .slice(0, 3);

  return (
    <li className="rounded-[2px] border border-hair">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[14px] text-ink marker:hidden [&::-webkit-details-marker]:hidden">
          <span className="uppercase tracking-[0.14em] text-faint">
            {label}
          </span>
          <span className="text-[12px] text-muted transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="border-t border-hair px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
            Read as
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {top.length > 0 ? (
              top.map((row) => {
                const accent = accentHex(
                  getTribeBySlug(row.slug)?.color ?? "",
                );
                return (
                  <li
                    key={row.slug}
                    className="rounded-[2px] border px-2.5 py-1 font-serif text-[14px]"
                    style={{ borderColor: accent, color: accent }}
                  >
                    {row.name}
                  </li>
                );
              })
            ) : (
              <li className="text-[14px] text-muted">No clear read</li>
            )}
          </ul>
        </div>
      </details>
    </li>
  );
}

const pct = (value: number) => Math.round(value * 100);
