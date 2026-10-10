import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import {
  buildComparison,
  topDivergences,
  type ComparisonRow,
} from "@/lib/observer/comparison";

/**
 * The 360 comparison report (issue #9): the Subject's own profile shown beside
 * the equal-weight aggregated "others" profile, the tribes where the two reads
 * diverge most, and an anonymous per-observer drill-down (Observer 1/2/3…).
 *
 * This is a presentational (server) component: it receives the already-computed
 * normalized scores and does only client-safe shaping (`buildComparison`), so no
 * scoring or word→tribe mapping crosses into it (ADR-0009). The per-observer
 * rows carry scores only — never any observer identity (ADR-0003).
 */
export function ComparisonReport({
  self,
  others,
  perObserver,
  observerCount,
}: {
  self: TribeScore[];
  others: TribeScore[];
  perObserver: TribeScore[][];
  observerCount: number;
}) {
  const rows = buildComparison(self, others);
  const divergences = topDivergences(rows, 3);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,54px)] font-semibold leading-[1.04]">
        How others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        Your own read sits beside the combined read of{" "}
        <span className="text-ink">{observerCount}</span> people who answered
        anonymously. Each observer counts equally, however many words they chose.
      </p>

      {/* Self vs others, tribe by tribe, on one shared scale. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-center justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            You vs. others
          </p>
          <Legend />
        </div>
        <ul className="mt-6 flex flex-col gap-5">
          {rows.map((row) => (
            <CompareRow key={row.slug} row={row} />
          ))}
        </ul>
      </section>

      {/* Where the two reads pull apart — the gap "where growth lives". */}
      {divergences.length > 0 && (
        <section className="mt-14 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where reads diverge
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            {divergences.map((row) => {
              const accent = accentHex(getTribeBySlug(row.slug)?.color ?? "");
              const othersSeeMore = row.gap < 0;
              return (
                <li
                  key={row.slug}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
                >
                  <span
                    className="font-serif text-[18px]"
                    style={{ color: accent }}
                  >
                    {row.name}
                  </span>
                  <span className="text-[14px] text-muted">
                    {othersSeeMore
                      ? "others see this in you more than you do"
                      : "you read this in yourself more than others do"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each observer
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Every response stays anonymous — no names, no relationships, just the
          read.
        </p>
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {perObserver.map((observer, index) => (
            <ObserverCard
              key={index}
              label={`Observer ${index + 1}`}
              scores={observer}
            />
          ))}
        </ul>
      </section>

      <div className="mt-14 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          ← Back to your result
        </Link>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.14em] text-faint">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-ink" aria-hidden />
        You
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="h-2.5 w-2.5 rounded-full border border-ink bg-transparent"
          aria-hidden
        />
        Others
      </span>
    </div>
  );
}

function CompareRow({ row }: { row: ComparisonRow }) {
  const accent = accentHex(getTribeBySlug(row.slug)?.color ?? "");
  return (
    <li className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]">
      <span className="font-serif text-[17px] leading-tight">{row.name}</span>
      <div className="flex flex-col gap-1.5">
        <Bar
          label={`You: ${pct(row.selfRelative)}% of the strongest read`}
          relative={row.selfRelative}
          score={row.selfScore}
          accent={accent}
          filled
        />
        <Bar
          label={`Others: ${pct(row.othersRelative)}% of the strongest read`}
          relative={row.othersRelative}
          score={row.othersScore}
          accent={accent}
          filled={false}
        />
      </div>
    </li>
  );
}

function Bar({
  label,
  relative,
  score,
  accent,
  filled,
}: {
  label: string;
  relative: number;
  score: number;
  accent: string;
  filled: boolean;
}) {
  const width = `${Math.max(relative * 100, score > 0 ? 3 : 0)}%`;
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={
          filled
            ? { width, backgroundColor: accent }
            : {
                width,
                backgroundColor: "transparent",
                boxShadow: `inset 0 0 0 1.5px ${accent}`,
                opacity: 0.85,
              }
        }
      />
    </div>
  );
}

function ObserverCard({
  label,
  scores,
}: {
  label: string;
  scores: TribeScore[];
}) {
  const top = [...scores]
    .sort((a, b) => b.score - a.score)
    .filter((s) => s.score > 0)
    .slice(0, 3);

  return (
    <li className="rounded-[2px] border border-hair p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
        {label}
      </div>
      {top.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {top.map((s) => {
            const accent = accentHex(getTribeBySlug(s.slug)?.color ?? "");
            return (
              <li key={s.slug} className="flex items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: accent }}
                  aria-hidden
                />
                <span className="font-serif text-[15px]">{s.name}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-[14px] text-muted">No clear read.</p>
      )}
    </li>
  );
}

function pct(score: number): number {
  return Math.round(score * 100);
}
