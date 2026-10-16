import Link from "next/link";
import { accentHex, getTribeBySlug, tribes } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import { aggregateObservers } from "@/lib/observer/aggregate";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * beside the equal-weight "others" profile, the places the two reads align or
 * diverge, and an anonymous per-observer drill-down.
 *
 * Server component: it scores words through the `server-only` core (ADR-0009),
 * so it renders only on the server and the word→tribe mapping never ships to the
 * client. The drill-down uses native `<details>` so it stays interactive with no
 * client JavaScript. The page gates rendering on the ≥3-observer unlock
 * (`isReportUnlocked`); by the time this renders there are at least three
 * responses, so the per-observer view never thins anonymity.
 */

/** Gaps smaller than this (on the 0–1 normalized scale) read as agreement. */
const DIVERGENCE_MIN = 0.08;

export function ComparisonReport({
  selfWords,
  observerWords,
}: {
  selfWords: string[];
  observerWords: string[][];
}) {
  const selfBySlug = new Map(score(selfWords).map((s) => [s.slug, s.score]));
  const othersBySlug = new Map(
    aggregateObservers(observerWords).map((s) => [s.slug, s.score]),
  );

  const rows = tribes.map((tribe) => {
    const self = selfBySlug.get(tribe.slug) ?? 0;
    const others = othersBySlug.get(tribe.slug) ?? 0;
    return { slug: tribe.slug, name: tribe.name, self, others, gap: others - self };
  });

  // Scale every bar to the single largest value across both reads so the chart
  // is readable regardless of the absolute normalized magnitudes.
  const maxVal = Math.max(0, ...rows.flatMap((r) => [r.self, r.others]));
  // Show the most prominent tribes (from either read) first; ties keep canonical
  // order via the stable sort over canonically-ordered rows.
  const ordered = [...rows].sort(
    (a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others),
  );

  const seenHigher = rows
    .filter((r) => r.gap >= DIVERGENCE_MIN)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3);
  const seenLower = rows
    .filter((r) => r.gap <= -DIVERGENCE_MIN)
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 3);
  const aligned = rows
    .filter((r) => (r.self > 0 || r.others > 0) && Math.abs(r.gap) < DIVERGENCE_MIN)
    .sort((a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others))
    .slice(0, 3);

  const observers = observerWords.map((words, i) => ({
    n: i + 1,
    top: rankScores(score(words)).slice(0, 3),
  }));

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-2 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.05]">
        You, and how others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[16px] leading-relaxed text-muted">
        The &ldquo;others&rdquo; profile is the equal-weight average of{" "}
        {observers.length} anonymous {observers.length === 1 ? "read" : "reads"}
        &mdash; each person counts the same, no matter how many words they
        picked. The gap between the two columns is where growth usually lives.
      </p>

      {/* Side-by-side bars — self vs others, every tribe. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-center justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Side by side
          </p>
          <p className="flex items-center gap-4 text-[11px] uppercase tracking-[0.14em] text-faint">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink/80" />
              You
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-gold" />
              Others
            </span>
          </p>
        </div>

        <ul className="mt-6 flex flex-col gap-5">
          {ordered.map((row) => {
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
                <div className="flex flex-col gap-1.5">
                  <ComparisonBar
                    label={`${row.name}, your read`}
                    value={row.self}
                    maxVal={maxVal}
                    className="bg-ink/80"
                  />
                  <ComparisonBar
                    label={`${row.name}, how others read you`}
                    value={row.others}
                    maxVal={maxVal}
                    className="bg-gold"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Where the two reads diverge or agree. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Alignment &amp; divergence
        </p>
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <DivergenceCard
            title="Others see more"
            hint="Strengths others notice that you underrate"
            rows={seenHigher}
            empty="No tribe stands out above your own read."
          />
          <DivergenceCard
            title="You see more"
            hint="Where your self-read runs ahead of theirs"
            rows={seenLower}
            empty="Nothing you rate well above how others read you."
          />
          <DivergenceCard
            title="You agree"
            hint="Where both reads land in the same place"
            rows={aligned}
            empty="No clear point of agreement yet."
          />
        </div>
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each read, anonymously
        </p>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          Each response is fully anonymous &mdash; no names, no labels, just the
          top tribes that read came back with.
        </p>
        <ul className="mt-6 flex flex-col gap-2.5">
          {observers.map((observer) => (
            <li key={observer.n}>
              <details className="group rounded-[3px] border border-hair bg-white/40 px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] text-ink">
                  <span className="font-serif text-[18px]">
                    Observer {observer.n}
                  </span>
                  <span className="text-[12px] uppercase tracking-[0.14em] text-faint transition-transform group-open:rotate-180">
                    ▾
                  </span>
                </summary>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {observer.top.map((t) => {
                    const tribe = getTribeBySlug(t.slug);
                    const accent = accentHex(tribe?.color ?? "");
                    return (
                      <li
                        key={t.slug}
                        className="grid grid-cols-[110px_1fr] items-center gap-3 max-[520px]:grid-cols-[88px_1fr]"
                      >
                        <span className="text-[14px] text-muted">{t.name}</span>
                        <div
                          className="h-2 overflow-hidden rounded-full bg-hair/50"
                          role="img"
                          aria-label={`${t.name}: ${Math.round(t.relative * 100)}% of this observer's top tribe`}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(t.relative * 100, t.score > 0 ? 4 : 0)}%`,
                              backgroundColor: accent,
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </details>
            </li>
          ))}
        </ul>
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

function ComparisonBar({
  label,
  value,
  maxVal,
  className,
}: {
  label: string;
  value: number;
  maxVal: number;
  className: string;
}) {
  const relative = maxVal > 0 ? value / maxVal : 0;
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={`${label}: ${Math.round(relative * 100)}% of the top score`}
    >
      <div
        className={`h-full rounded-full ${className}`}
        style={{ width: `${Math.max(relative * 100, value > 0 ? 3 : 0)}%` }}
      />
    </div>
  );
}

function DivergenceCard({
  title,
  hint,
  rows,
  empty,
}: {
  title: string;
  hint: string;
  rows: { slug: string; name: string; gap: number }[];
  empty: string;
}) {
  return (
    <div className="rounded-[3px] border border-hair bg-white/40 p-5">
      <p className="font-serif text-[18px] text-ink">{title}</p>
      <p className="mt-1 text-[13px] leading-snug text-faint">{hint}</p>
      {rows.length === 0 ? (
        <p className="mt-4 text-[14px] text-muted">{empty}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {rows.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            const points = Math.round(Math.abs(row.gap) * 100);
            return (
              <li
                key={row.slug}
                className="flex items-center justify-between text-[15px]"
              >
                <span className="font-serif" style={{ color: accent }}>
                  {row.name}
                </span>
                <span className="text-[13px] tabular-nums text-muted">
                  {row.gap > 0 ? "+" : "−"}
                  {points}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
