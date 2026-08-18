import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";
import { aggregateObservers } from "@/lib/assessment/aggregate-observers";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * beside the equal-weight aggregate of how their Observers see them, with the
 * alignment and divergence called out and an anonymous per-observer drill-down.
 *
 * Rendered only once the report has unlocked (≥3 Observers) — the page owns that
 * gate and the locked state; this component assumes it has enough Observers to be
 * meaningful. It is a server component: it imports the `server-only` scoring core
 * so the word→tribe mapping never reaches the client (ADR-0009). Observers are
 * surfaced strictly as "Observer 1 / 2 / 3" with no identifying data.
 */
export function ComparisonReport({
  selfWords,
  primarySlug,
  observerResponses,
}: {
  selfWords: string[];
  primarySlug: string;
  observerResponses: string[][];
}) {
  const self = score(selfWords);
  const { others, perObserver, observerCount } =
    aggregateObservers(observerResponses);

  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));

  // A shared scale so the self and others bars are directly comparable: the
  // largest score across both profiles fills its bar, the rest draw in
  // proportion. Both inputs are already normalized 0–1 (ADR-0001).
  const sharedMax = Math.max(
    ...self.map((s) => s.score),
    ...others.map((s) => s.score),
    0,
  );

  // Order the twelve by their strongest of the two reads, so the tribes that
  // matter to either view rise to the top; canonical order breaks ties because
  // `self`/`others` are already in canonical order.
  const rows = self
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      selfScore: s.score,
      othersScore: othersBySlug.get(s.slug) ?? 0,
    }))
    .sort(
      (a, b) =>
        Math.max(b.selfScore, b.othersScore) -
        Math.max(a.selfScore, a.othersScore),
    );

  const othersTop = [...others].sort((a, b) => b.score - a.score)[0];
  const selfTop = [...self].sort((a, b) => b.score - a.score)[0];
  const agreeOnPrimary = othersTop?.slug === selfTop?.slug;

  // Divergences: where the two reads disagree most, largest gap first. Only gaps
  // with real signal (either side non-trivial) are worth surfacing.
  const divergences = rows
    .map((r) => ({ ...r, gap: r.othersScore - r.selfScore }))
    .filter((r) => Math.abs(r.gap) > 0.01)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 3);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Self vs others
      </p>
      <h1 className="mt-2 font-serif text-[clamp(30px,5vw,44px)] font-semibold leading-[1.05]">
        How your read compares
      </h1>
      <p className="mt-3 max-w-[560px] text-[15px] text-muted">
        Your own selections beside the combined read of{" "}
        <strong className="text-ink">{observerCount}</strong> people, each
        counted equally. {agreeOnPrimary ? (
          <>
            You and your observers land on the same strongest tribe —{" "}
            <strong className="text-ink">{selfTop?.name}</strong>.
          </>
        ) : (
          <>
            You lead with{" "}
            <strong className="text-ink">{selfTop?.name}</strong>; the people
            around you lead with{" "}
            <strong className="text-ink">{othersTop?.name}</strong>.
          </>
        )}
      </p>

      {/* Side-by-side bars: self and others for every tribe. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-center gap-5 text-[11px] uppercase tracking-[0.14em] text-faint">
          <span className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink" />
            You
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-gold" />
            Others
          </span>
        </div>
        <ul className="mt-6 flex flex-col gap-5">
          {rows.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li
                key={row.slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <span
                  className="font-serif text-[17px] leading-tight"
                  style={{
                    color: row.slug === primarySlug ? accent : undefined,
                  }}
                >
                  {row.name}
                </span>
                <div className="flex flex-col gap-1.5">
                  <CompareBar
                    label={`${row.name}, your read`}
                    value={row.selfScore}
                    max={sharedMax}
                    color="var(--ink)"
                  />
                  <CompareBar
                    label={`${row.name}, others' read`}
                    value={row.othersScore}
                    max={sharedMax}
                    color="var(--gold)"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Where the two reads diverge most — the useful gap. */}
      {divergences.length > 0 && (
        <section className="mt-14 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where you and others see it differently
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            {divergences.map((row) => (
              <li key={row.slug} className="text-[15px] text-ink">
                <span className="font-serif text-[17px]">{row.name}</span>{" "}
                <span className="text-muted">
                  {row.gap > 0
                    ? "— others see this in you more than you do"
                    : "— you claim this more than others see it"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Anonymous per-observer drill-down: Observer 1 / 2 / 3, no identity. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          The spread of opinion
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Each observer stays anonymous — no names, no relationships. Here is the
          strongest tribe each one saw in you.
        </p>
        <ul className="mt-6 flex flex-col gap-4">
          {perObserver.map((observer, index) => (
            <ObserverRow key={index} index={index} scores={observer} />
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

/** A single proportional bar, scaled against a shared max across both reads. */
function CompareBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const relative = max > 0 ? value / max : 0;
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={`${label}: ${Math.round(relative * 100)}% of the top score`}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${Math.max(relative * 100, value > 0 ? 3 : 0)}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

/** One anonymous observer's top tribes, drawn as small chips. */
function ObserverRow({ index, scores }: { index: number; scores: TribeScore[] }) {
  const top = [...scores]
    .sort((a, b) => b.score - a.score)
    .filter((s) => s.score > 0)
    .slice(0, 3);
  return (
    <li className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <span className="w-[92px] shrink-0 text-[12px] uppercase tracking-[0.14em] text-faint">
        Observer {index + 1}
      </span>
      <div className="flex flex-wrap gap-2">
        {top.length === 0 ? (
          <span className="text-[14px] text-muted">No clear signal</span>
        ) : (
          top.map((s) => {
            const tribe = getTribeBySlug(s.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <span
                key={s.slug}
                className="rounded-[2px] border px-3 py-1 text-[13px] text-ink"
                style={{ borderColor: accent, backgroundColor: `${accent}14` }}
              >
                {s.name}
              </span>
            );
          })
        )}
      </div>
    </li>
  );
}
