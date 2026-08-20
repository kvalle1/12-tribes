import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  compareProfiles,
} from "@/lib/assessment/aggregateObservers";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). Shown to a
 * Subject once at least three Observers have responded — the unlock gate lives
 * in the page (`isReportUnlocked`); this view assumes it has been cleared.
 *
 * It scores the Subject's own words and the equal-weight "others" profile
 * server-side (the scoring core and word→tribe mapping are `server-only`) and
 * passes only the resulting numbers into the markup, so nothing about the
 * mapping — or any Observer's identity — reaches the client. Observers appear as
 * "Observer 1/2/3" by position only.
 *
 * Render this only from a server component.
 */
export function ComparisonReport({
  selfWords,
  observerResponses,
}: {
  selfWords: string[];
  observerResponses: { words: string[] }[];
}) {
  const self = score(selfWords);
  const others = aggregateObservers(observerResponses.map((r) => r.words));
  const rows = compareProfiles(self, others);

  // Order tribes by their strongest reading across the two profiles, so the
  // tribes that matter to either view surface first. Ties keep canonical order.
  const ordered = [...rows].sort(
    (a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others),
  );

  // Shared scale across both series so a "You" bar and an "Others" bar are
  // directly comparable at a glance.
  const max = Math.max(
    ...rows.map((r) => Math.max(r.self, r.others)),
    0,
  );

  // The sharpest divergences — where the Subject sees a tribe more strongly than
  // others do, and where others see it more strongly than the Subject does.
  const byDelta = [...rows].sort((a, b) => b.delta - a.delta);
  const seenMoreByYou = byDelta[0];
  const seenMoreByOthers = byDelta[byDelta.length - 1];
  const DIVERGENCE_FLOOR = 0.08;

  const observerProfiles = observerResponses.map((response) => {
    const ranked = [...score(response.words)]
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    return ranked;
  });

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        You, and how others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Your own word selection sits beside the equal-weight average of{" "}
        {observerResponses.length} anonymous{" "}
        {observerResponses.length === 1 ? "observer" : "observers"}. Each
        observer counts the same, however many words they picked. The gaps — not
        the matches — are where the most useful insight lives.
      </p>

      {/* Divergence callouts. */}
      {(seenMoreByYou?.delta > DIVERGENCE_FLOOR ||
        -seenMoreByOthers?.delta > DIVERGENCE_FLOOR) && (
        <section className="mt-12 grid gap-4 sm:grid-cols-2">
          {seenMoreByYou && seenMoreByYou.delta > DIVERGENCE_FLOOR && (
            <DivergenceCard
              label="You lean into this more"
              slug={seenMoreByYou.slug}
              name={seenMoreByYou.name}
            />
          )}
          {seenMoreByOthers && -seenMoreByOthers.delta > DIVERGENCE_FLOOR && (
            <DivergenceCard
              label="Others see this more than you do"
              slug={seenMoreByOthers.slug}
              name={seenMoreByOthers.name}
            />
          )}
        </section>
      )}

      {/* Paired self / others bars for all twelve tribes. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-center justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            You vs others
          </p>
          <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.12em] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink" />
              You
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink/30" />
              Others
            </span>
          </div>
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
                <span className="font-serif text-[17px] leading-tight">
                  {row.name}
                </span>
                <div className="flex flex-col gap-1.5">
                  <CompareBar
                    value={row.self}
                    max={max}
                    color={accent}
                    opacity={1}
                    seriesLabel={`You: ${row.name}`}
                  />
                  <CompareBar
                    value={row.others}
                    max={max}
                    color={accent}
                    opacity={0.4}
                    seriesLabel={`Others: ${row.name}`}
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
          The tribes each observer&rsquo;s words leaned toward. Responses are
          fully anonymous — no names, no order that ties back to anyone.
        </p>
        <ul className="mt-6 flex flex-col gap-4">
          {observerProfiles.map((ranked, i) => (
            <li
              key={i}
              className="grid grid-cols-[110px_1fr] items-start gap-4 max-[520px]:grid-cols-[92px_1fr]"
            >
              <span className="text-[13px] uppercase tracking-[0.12em] text-faint">
                Observer {i + 1}
              </span>
              <ul className="flex flex-wrap gap-2">
                {ranked.length === 0 && (
                  <li className="text-[14px] text-muted">No clear lean</li>
                )}
                {ranked.map((s) => {
                  const tribe = getTribeBySlug(s.slug);
                  const accent = accentHex(tribe?.color ?? "");
                  return (
                    <li
                      key={s.slug}
                      className="rounded-[2px] border px-3 py-1.5 text-[14px] text-ink"
                      style={{
                        borderColor: `${accent}66`,
                        backgroundColor: `${accent}14`,
                      }}
                    >
                      {s.name}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function CompareBar({
  value,
  max,
  color,
  opacity,
  seriesLabel,
}: {
  value: number;
  max: number;
  color: string;
  opacity: number;
  seriesLabel: string;
}) {
  const fraction = max > 0 ? value / max : 0;
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={`${seriesLabel}: ${Math.round(fraction * 100)}% of the top score`}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.max(fraction * 100, value > 0 ? 3 : 0)}%`,
          backgroundColor: color,
          opacity,
        }}
      />
    </div>
  );
}

function DivergenceCard({
  label,
  slug,
  name,
}: {
  label: string;
  slug: string;
  name: string;
}) {
  const tribe = getTribeBySlug(slug);
  const accent = accentHex(tribe?.color ?? "");
  return (
    <div
      className="rounded-[3px] border border-hair bg-white/40 p-5"
      style={{ borderLeftColor: accent, borderLeftWidth: 3 }}
    >
      <p className="text-[11px] uppercase tracking-[0.14em] text-faint">
        {label}
      </p>
      <p className="mt-1.5 font-serif text-[24px] font-semibold leading-tight">
        <span style={{ color: accent }}>{name}</span>
      </p>
    </div>
  );
}
