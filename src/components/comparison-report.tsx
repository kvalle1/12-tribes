import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { MIN_OBSERVERS } from "@/lib/observer/aggregate";
import type { ComparisonReport as Report } from "@/lib/observer/report";

/**
 * The 360 comparison report view (issue #9, ADR-0003): the Subject's own profile
 * set beside the equal-weight aggregated "others" profile, with the tribes where
 * self and others agree or diverge called out, and an anonymous per-Observer
 * drill-down.
 *
 * It is a dumb renderer — every number (self, others, gaps, ordering) is
 * precomputed server-side by `buildComparisonReport`, so this component never
 * touches the scoring core or the word→tribe mapping. Until at least
 * `MIN_OBSERVERS` Observers respond it shows only a locked progress state; no
 * Observer's answer is rendered before the aggregate is meaningful and anonymous.
 */
export function ComparisonReport({ report }: { report: Report }) {
  if (!report.unlocked) {
    return <LockedState report={report} />;
  }

  // A shared scale so the self and others bars are directly comparable.
  const scaleMax =
    Math.max(
      ...report.comparison.map((c) => Math.max(c.selfScore, c.othersScore)),
      0,
    ) || 1;

  const highlights = pickHighlights(report);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        The 360 comparison
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,52px)] font-semibold leading-[1.05]">
        How others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        Your own read is set beside the equal-weight average of{" "}
        {report.observerCount} anonymous{" "}
        {report.observerCount === 1 ? "response" : "responses"}. Each responder
        counts once, however many words they picked, so no single voice
        outweighs the rest.
      </p>

      {highlights.length > 0 && (
        <section className="mt-12 grid gap-4 sm:grid-cols-2">
          {highlights.map((h) => (
            <div
              key={h.key}
              className="rounded-[2px] border border-hair p-5"
              style={{ borderLeftColor: h.accent, borderLeftWidth: 3 }}
            >
              <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
                {h.label}
              </div>
              <div className="mt-2 font-serif text-[22px] leading-snug">
                {h.tribeName}
              </div>
              <p className="mt-1.5 text-[13px] text-muted">{h.note}</p>
            </div>
          ))}
        </section>
      )}

      {/* Self vs others, all twelve tribes, strongest-first. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-center justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Self vs others
          </p>
          <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.14em] text-faint">
            <LegendSwatch className="bg-ink" label="You" />
            <LegendSwatch className="bg-faint" label="Others" />
          </div>
        </div>

        <ul className="mt-6 flex flex-col gap-5">
          {report.comparison.map((row) => {
            const accent = accentHex(getTribeBySlug(row.slug)?.color ?? "");
            return (
              <li
                key={row.slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <span className="font-serif text-[17px] leading-tight">
                  {row.name}
                </span>
                <div className="flex flex-col gap-1.5">
                  <CompareBar
                    label="You"
                    fraction={row.selfScore / scaleMax}
                    hasScore={row.selfScore > 0}
                    color={accent}
                  />
                  <CompareBar
                    label="Others"
                    fraction={row.othersScore / scaleMax}
                    hasScore={row.othersScore > 0}
                    color={accent}
                    muted
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each observer, anonymously
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Every responder is fully anonymous — labelled only in the order they
          replied. Here are the tribes each one leaned toward.
        </p>
        <ul className="mt-6 flex flex-col gap-4">
          {report.observers.map((observer) => {
            const top = [...observer.scores]
              .filter((s) => s.score > 0)
              .sort((a, b) => b.score - a.score)
              .slice(0, 3);
            return (
              <li
                key={observer.index}
                className="rounded-[2px] border border-hair p-5"
              >
                <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
                  Observer {observer.index}
                </div>
                <ul className="mt-3 flex flex-wrap gap-2.5">
                  {top.length > 0 ? (
                    top.map((s) => {
                      const accent = accentHex(
                        getTribeBySlug(s.slug)?.color ?? "",
                      );
                      return (
                        <li
                          key={s.slug}
                          className="rounded-[2px] border px-3 py-1.5 text-[13px]"
                          style={{
                            borderColor: `${accent}66`,
                            backgroundColor: `${accent}12`,
                          }}
                        >
                          {s.name}
                        </li>
                      );
                    })
                  ) : (
                    <li className="text-[13px] text-faint">No clear lean</li>
                  )}
                </ul>
              </li>
            );
          })}
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

/**
 * The pre-unlock state: a Subject who hasn't yet gathered `MIN_OBSERVERS`
 * responses sees only how many more are needed and a prompt to share their link
 * — never a partial aggregate.
 */
function LockedState({ report }: { report: Report }) {
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        The 360 comparison
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,52px)] font-semibold leading-[1.05]">
        Not unlocked yet
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        The comparison opens once at least {MIN_OBSERVERS} people have responded
        — enough for the average to mean something and for every response to stay
        anonymous. So far{" "}
        <span className="text-ink">
          {report.observerCount} of {MIN_OBSERVERS}
        </span>{" "}
        {report.observerCount === 1 ? "person has" : "people have"} replied.
      </p>

      <div className="mt-8 flex items-center gap-2.5">
        {Array.from({ length: MIN_OBSERVERS }).map((_, i) => (
          <span
            key={i}
            className={`h-2.5 flex-1 rounded-full ${
              i < report.observerCount ? "bg-gold" : "bg-hair"
            }`}
            aria-hidden
          />
        ))}
      </div>
      <p className="mt-3 text-[13px] text-faint">
        {report.remaining} more{" "}
        {report.remaining === 1 ? "response" : "responses"} to go.
      </p>

      <div className="mt-12 border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Get your share link
        </Link>
      </div>
    </div>
  );
}

function CompareBar({
  label,
  fraction,
  hasScore,
  color,
  muted = false,
}: {
  label: string;
  fraction: number;
  hasScore: boolean;
  color: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-[46px] shrink-0 text-[10px] uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${Math.round(fraction * 100)}% of the top score`}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(fraction * 100, hasScore ? 3 : 0)}%`,
            backgroundColor: color,
            opacity: muted ? 0.4 : 1,
          }}
        />
      </div>
    </div>
  );
}

function LegendSwatch({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}

interface Highlight {
  key: string;
  label: string;
  tribeName: string;
  note: string;
  accent: string;
}

/**
 * Pull the tribe where self and others agree most and the one where they
 * diverge most, for the two callouts atop the report. "Agreement" is judged only
 * among tribes that actually carry signal (either side scoring above zero) so a
 * shared blank isn't mistaken for alignment.
 */
function pickHighlights(report: Report): Highlight[] {
  const meaningful = report.comparison.filter(
    (c) => c.selfScore > 0 || c.othersScore > 0,
  );
  if (meaningful.length === 0) return [];

  const closest = meaningful.reduce((best, c) =>
    Math.abs(c.gap) < Math.abs(best.gap) ? c : best,
  );
  const widest = meaningful.reduce((best, c) =>
    Math.abs(c.gap) > Math.abs(best.gap) ? c : best,
  );

  const highlights: Highlight[] = [
    {
      key: `align-${closest.slug}`,
      label: "Strongest agreement",
      tribeName: closest.name,
      note: "You and the people who know you read this one the same way.",
      accent: accentHex(getTribeBySlug(closest.slug)?.color ?? ""),
    },
  ];

  // Only surface a divergence callout if it's a different tribe and a real gap.
  if (widest.slug !== closest.slug && Math.abs(widest.gap) > 0) {
    highlights.push({
      key: `diverge-${widest.slug}`,
      label: "Biggest gap",
      tribeName: widest.name,
      note:
        widest.gap > 0
          ? "You see more of this in yourself than others do — the gap is where growth lives."
          : "Others see more of this in you than you claim for yourself.",
      accent: accentHex(getTribeBySlug(widest.slug)?.color ?? ""),
    });
  }

  return highlights;
}
