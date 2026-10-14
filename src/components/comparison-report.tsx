import { accentHex, getTribeBySlug } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";

/**
 * The 360 self-vs-others comparison report body (issue #9, ADR-0003). Pure
 * presentation: it receives already-scored profiles (the Subject's own and the
 * equal-weight "others" aggregate, plus each anonymous Observer's individual
 * profile) and renders them — all scoring runs on the server before this view,
 * so no word→tribe mapping or scoring logic reaches the client.
 *
 * Self and others bars share one scale (the largest score across both profiles)
 * so their lengths are directly comparable. The report highlights where the two
 * reads align and where they diverge, and offers an anonymous per-observer
 * drill-down (Observer 1 / 2 / 3 …) that never carries any attribute tying a
 * response back to a person.
 */

/** A per-tribe comparison row with both reads on a shared 0–1 fill scale. */
interface ComparisonRow {
  slug: string;
  name: string;
  selfScore: number;
  othersScore: number;
  selfFill: number;
  othersFill: number;
}

function buildRows(self: TribeScore[], others: TribeScore[]): ComparisonRow[] {
  const othersBySlug = new Map(others.map((o) => [o.slug, o.score]));
  const sharedMax = Math.max(
    0,
    ...self.map((s) => s.score),
    ...others.map((o) => o.score),
  );

  return self
    .map((s) => {
      const othersScore = othersBySlug.get(s.slug) ?? 0;
      return {
        slug: s.slug,
        name: s.name,
        selfScore: s.score,
        othersScore,
        selfFill: sharedMax > 0 ? s.score / sharedMax : 0,
        othersFill: sharedMax > 0 ? othersScore / sharedMax : 0,
      };
    })
    .sort((a, b) => {
      const aMax = Math.max(a.selfScore, a.othersScore);
      const bMax = Math.max(b.selfScore, b.othersScore);
      return bMax - aMax; // stable sort keeps canonical order on ties
    });
}

export function ComparisonReport({
  self,
  others,
  perObserver,
}: {
  self: TribeScore[];
  others: TribeScore[];
  perObserver: TribeScore[][];
}) {
  const rows = buildRows(self, others);
  const observerCount = perObserver.length;

  // Divergence: where the Subject reads higher than others, and vice versa.
  const byGap = [...rows].sort(
    (a, b) => b.selfScore - b.othersScore - (a.selfScore - a.othersScore),
  );
  const youMore = byGap.filter((r) => r.selfScore - r.othersScore > 0.001).slice(0, 2);
  const othersMore = [...byGap]
    .reverse()
    .filter((r) => r.othersScore - r.selfScore > 0.001)
    .slice(0, 2);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.05]">
        You, and how others see you
      </h1>
      <p className="mt-3 max-w-[560px] text-[15px] text-muted">
        Your own word selection beside the equal-weight average of{" "}
        {observerCount} anonymous {observerCount === 1 ? "read" : "reads"}. Each
        observer counts the same, however many words they picked. The gap — where
        your read and theirs part ways — is where the most useful insight lives.
      </p>

      {/* Legend */}
      <div className="mt-8 flex items-center gap-6 text-[12px] uppercase tracking-[0.16em] text-faint">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-5 rounded-full bg-ink" />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-5 rounded-full bg-gold/70" />
          Others ({observerCount})
        </span>
      </div>

      {/* Side-by-side bars, shared scale. */}
      <section className="mt-6 border-t border-hair pt-8">
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
                  className="font-serif text-[17px] leading-none"
                  style={{ color: accent }}
                >
                  {row.name}
                </span>
                <div
                  className="flex flex-col gap-1.5"
                  role="img"
                  aria-label={`${row.name}: you ${Math.round(
                    row.selfScore * 100,
                  )}, others ${Math.round(row.othersScore * 100)}`}
                >
                  <Bar fill={row.selfFill} color="var(--ink, #1c1b18)" muted={false} />
                  <Bar fill={row.othersFill} color={accent} muted />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Alignment / divergence callout. */}
      {(youMore.length > 0 || othersMore.length > 0) && (
        <section className="mt-12 grid gap-6 border-t border-hair pt-8 sm:grid-cols-2">
          <div>
            <p className="text-[12px] uppercase tracking-[0.18em] text-faint">
              You lean into
            </p>
            <p className="mt-2 text-[15px] text-muted">
              {youMore.length > 0
                ? `You pick ${listNames(youMore)} more than others see in you.`
                : "Nothing stands out above how others read you."}
            </p>
          </div>
          <div>
            <p className="text-[12px] uppercase tracking-[0.18em] text-faint">
              Others see more
            </p>
            <p className="mt-2 text-[15px] text-muted">
              {othersMore.length > 0
                ? `Others see ${listNames(othersMore)} more than you claim.`
                : "Others don't read anything above your own account."}
            </p>
          </div>
        </section>
      )}

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-12 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each read, anonymously
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          The spread of opinion, one observer at a time. These are deliberately
          unlabeled — no name, no relationship — so no single read can be traced
          back to a person.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          {perObserver.map((observer, i) => (
            <ObserverDrilldown key={i} index={i + 1} scores={observer} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Bar({
  fill,
  color,
  muted,
}: {
  fill: number;
  color: string;
  muted: boolean;
}) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-hair/50">
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${Math.max(fill * 100, fill > 0 ? 3 : 0)}%`,
          backgroundColor: color,
          opacity: muted ? 0.7 : 1,
        }}
      />
    </div>
  );
}

function ObserverDrilldown({
  index,
  scores,
}: {
  index: number;
  scores: TribeScore[];
}) {
  const max = Math.max(0, ...scores.map((s) => s.score));
  const ranked = [...scores]
    .sort((a, b) => b.score - a.score)
    .filter((s) => s.score > 0)
    .slice(0, 5);

  return (
    <details className="group rounded-[2px] border border-hair bg-white/40 px-4 py-3 [&_summary]:cursor-pointer">
      <summary className="flex items-center justify-between text-[14px] text-ink marker:content-['']">
        <span className="font-serif text-[16px]">Observer {index}</span>
        <span className="text-[11px] uppercase tracking-[0.14em] text-faint group-open:hidden">
          Show
        </span>
        <span className="hidden text-[11px] uppercase tracking-[0.14em] text-faint group-open:inline">
          Hide
        </span>
      </summary>
      <ul className="mt-4 flex flex-col gap-2.5">
        {ranked.map((row) => {
          const tribe = getTribeBySlug(row.slug);
          const accent = accentHex(tribe?.color ?? "");
          return (
            <li
              key={row.slug}
              className="grid grid-cols-[110px_1fr] items-center gap-3 max-[520px]:grid-cols-[88px_1fr]"
            >
              <span className="text-[13px] text-muted">{row.name}</span>
              <Bar
                fill={max > 0 ? row.score / max : 0}
                color={accent}
                muted={false}
              />
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/** Join tribe names as "A", "A and B", keeping the copy natural. */
function listNames(rows: { name: string }[]): string {
  const names = rows.map((r) => r.name);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
