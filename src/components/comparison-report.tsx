import { accentHex, getTribeBySlug } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import type { ProfileComparison } from "@/lib/assessment/aggregateObservers";

/**
 * The 360 comparison report (issue #9): the Subject's own profile set beside the
 * equal-weight "others" profile, tribe by tribe, with a callout for where the
 * two views diverge most and an anonymous per-observer drill-down.
 *
 * Purely presentational — it receives already-computed scores (the scoring core
 * and the equal-weight aggregation are `server-only` and run on the page). It
 * imports only *types* from those modules and the client-safe tribe metadata, so
 * it drags no scoring logic or word→tribe mapping toward the client. The
 * per-observer drill-down is deliberately anonymous: each response is labeled
 * "Observer N" and carries only scores — never any attribute of who submitted it
 * (ADR-0003).
 */
export function ComparisonReport({
  comparison,
  perObserver,
}: {
  comparison: ProfileComparison[];
  perObserver: TribeScore[][];
}) {
  // Self and others share one scale so the two bars are directly comparable; the
  // single strongest bar across either profile fills, the rest draw in
  // proportion (mirrors the result view's readable-bars approach).
  const maxScore = Math.max(
    0,
    ...comparison.map((c) => Math.max(c.self, c.others)),
  );

  // Rank by the stronger of the two readings so the tribes that matter to either
  // view surface first.
  const ranked = [...comparison].sort(
    (a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others),
  );

  // The sharpest disagreements, largest gap first — only genuinely divergent
  // tribes (a small floor filters out noise-level gaps).
  const divergences = [...comparison]
    .filter((c) => Math.abs(c.divergence) >= 0.08)
    .sort((a, b) => Math.abs(b.divergence) - Math.abs(a.divergence))
    .slice(0, 3);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-2 font-serif text-[clamp(34px,6vw,54px)] font-semibold leading-[1.04]">
        You, and how others see you
      </h1>
      <p className="mt-3 max-w-[540px] text-[15px] text-muted">
        Your own profile beside the combined read from{" "}
        {perObserver.length} {perObserver.length === 1 ? "person" : "people"} who
        described you. Each person counts equally, no matter how many words they
        picked.
      </p>

      {/* Where the two views pull apart. */}
      {divergences.length > 0 && (
        <section className="mt-12 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where you diverge
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            {divergences.map((c) => {
              const youHigher = c.divergence > 0;
              const accent = accentHex(getTribeBySlug(c.slug)?.color ?? "");
              return (
                <li key={c.slug} className="text-[15px] text-ink">
                  <span
                    className="font-serif text-[17px]"
                    style={{ color: accent }}
                  >
                    {c.name}
                  </span>{" "}
                  <span className="text-muted">
                    {youHigher
                      ? "— you see this in yourself more than others do"
                      : "— others see this in you more than you do"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Self vs others, all twelve tribes on one scale. */}
      <section className="mt-12 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          You vs. others, tribe by tribe
        </p>
        <div className="mt-4 flex items-center gap-5 text-[11px] uppercase tracking-[0.14em] text-faint">
          <LegendSwatch filled label="You" />
          <LegendSwatch label="Others" />
        </div>
        <ul className="mt-6 flex flex-col gap-5">
          {ranked.map((c) => {
            const accent = accentHex(getTribeBySlug(c.slug)?.color ?? "");
            return (
              <li
                key={c.slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <span className="font-serif text-[17px] leading-tight">
                  {c.name}
                </span>
                <div className="flex flex-col gap-1.5">
                  <CompareBar
                    label="You"
                    score={c.self}
                    maxScore={maxScore}
                    accent={accent}
                    filled
                  />
                  <CompareBar
                    label="Others"
                    score={c.others}
                    maxScore={maxScore}
                    accent={accent}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-12 border-t border-hair pt-8">
        <details className="group">
          <summary className="cursor-pointer list-none text-[12px] uppercase tracking-[0.2em] text-faint transition-colors hover:text-ink">
            <span className="group-open:hidden">Show individual observers ▾</span>
            <span className="hidden group-open:inline">Hide individual observers ▴</span>
          </summary>
          <p className="mt-4 max-w-[520px] text-[14px] text-muted">
            Each response is anonymous — no names, no relationships. Only the
            spread of how each person read you.
          </p>
          <ol className="mt-6 flex flex-col gap-6">
            {perObserver.map((observer, index) => {
              const top = [...observer]
                .sort((a, b) => b.score - a.score)
                .filter((t) => t.score > 0)
                .slice(0, 3);
              return (
                <li key={index}>
                  <p className="text-[13px] uppercase tracking-[0.16em] text-ink">
                    Observer {index + 1}
                  </p>
                  {top.length > 0 ? (
                    <ul className="mt-2 flex flex-wrap gap-2.5">
                      {top.map((t) => (
                        <li
                          key={t.slug}
                          className="rounded-[2px] border border-gold/40 bg-gold/10 px-3 py-1 text-[13px] text-ink"
                          style={{
                            borderColor: `${accentHex(getTribeBySlug(t.slug)?.color ?? "")}66`,
                          }}
                        >
                          {t.name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-[13px] text-faint">No clear read.</p>
                  )}
                </li>
              );
            })}
          </ol>
        </details>
      </section>
    </div>
  );
}

function CompareBar({
  label,
  score,
  maxScore,
  accent,
  filled = false,
}: {
  label: string;
  score: number;
  maxScore: number;
  accent: string;
  filled?: boolean;
}) {
  const relative = maxScore > 0 ? score / maxScore : 0;
  const width = `${Math.max(relative * 100, score > 0 ? 3 : 0)}%`;
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
          style={
            filled
              ? { width, backgroundColor: accent }
              : {
                  width,
                  backgroundColor: "transparent",
                  border: `1.5px solid ${accent}`,
                  opacity: 0.85,
                }
          }
        />
      </div>
    </div>
  );
}

function LegendSwatch({ label, filled = false }: { label: string; filled?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={
          filled
            ? { backgroundColor: "var(--gold, #b8912f)" }
            : { border: "1.5px solid var(--gold, #b8912f)" }
        }
      />
      {label}
    </span>
  );
}
