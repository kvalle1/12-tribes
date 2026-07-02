import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";

/**
 * The 360 comparison report (issue #9): the Subject's own Self Assessment
 * profile shown alongside the equal-weight aggregated "others" profile, the
 * tribes where the two reads align and diverge, and an anonymous per-observer
 * drill-down.
 *
 * Presentational only — it receives already-computed, normalized `TribeScore[]`
 * arrays (the Strength Profile shape, ADR-0002) and never touches the word→tribe
 * mapping or the scoring core, so it carries nothing across the client trust
 * boundary (ADR-0009) beyond tribe names and numbers. Scoring and aggregation
 * happen server-side in the page; this just draws the result.
 *
 * The caller only renders this once at least three observers have responded
 * (`MIN_OBSERVERS_TO_UNLOCK`, ADR-0003); the locked state lives in the page.
 */

const byScore = (a: TribeScore, b: TribeScore) => b.score - a.score;

export function ComparisonReport({
  self,
  others,
  perObserver,
}: {
  self: TribeScore[];
  others: TribeScore[];
  perObserver: TribeScore[][];
}) {
  // Both profiles are 0–1 normalized; draw every bar against one shared maximum
  // so "You" and "Others" are directly, honestly comparable.
  const chartMax = Math.max(
    ...self.map((s) => s.score),
    ...others.map((s) => s.score),
    // Guard against an all-zero divide; a 0 max just yields empty bars.
    0.0001,
  );

  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));

  // Order the chart by the stronger of the two reads for each tribe, so the
  // tribes that matter to either party surface at the top.
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

  // Divergences: where the two reads disagree most. Signed so we can say who
  // scored the tribe higher.
  const divergences = rows
    .map((r) => ({ ...r, delta: r.selfScore - r.othersScore }))
    .filter((r) => Math.abs(r.delta) >= 0.12)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);

  // Alignment: the tribe both reads land on most strongly with the smallest gap.
  const alignment = rows
    .filter((r) => Math.min(r.selfScore, r.othersScore) > 0.15)
    .sort(
      (a, b) =>
        Math.min(b.selfScore, b.othersScore) -
        Math.abs(b.selfScore - b.othersScore) -
        (Math.min(a.selfScore, a.othersScore) -
          Math.abs(a.selfScore - a.othersScore)),
    )
    .slice(0, 1);

  const othersTop = [...others].sort(byScore)[0];

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Self vs. others
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        How your read compares
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        Your own profile beside the combined read of{" "}
        <span className="text-ink">{perObserver.length} people</span> who know
        you. Each observer counts equally — no one who picked more words carries
        more weight (ADR-0003). The gap is where the most useful insight lives.
      </p>

      {/* Alignment & divergence callouts. */}
      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[2px] border border-hair p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
            Where you agree
          </p>
          {alignment.length > 0 ? (
            <p className="mt-2 font-serif text-[18px] leading-snug">
              You and they both read you as strongly{" "}
              <TribeName slug={alignment[0].slug} name={alignment[0].name} />.
            </p>
          ) : (
            <p className="mt-2 text-[15px] text-muted">
              No single tribe stands out as a shared strong read yet.
            </p>
          )}
        </div>
        <div className="rounded-[2px] border border-hair p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
            Biggest gap
          </p>
          {divergences.length > 0 ? (
            <p className="mt-2 font-serif text-[18px] leading-snug">
              {divergences[0].delta > 0 ? (
                <>
                  You lean more{" "}
                  <TribeName
                    slug={divergences[0].slug}
                    name={divergences[0].name}
                  />{" "}
                  than others see in you.
                </>
              ) : (
                <>
                  Others see more{" "}
                  <TribeName
                    slug={divergences[0].slug}
                    name={divergences[0].name}
                  />{" "}
                  in you than you claim.
                </>
              )}
            </p>
          ) : (
            <p className="mt-2 text-[15px] text-muted">
              Your read and theirs line up closely across the board.
            </p>
          )}
        </div>
      </section>

      {/* The dual-bar chart: you vs others, tribe by tribe. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-baseline justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            You vs. others, tribe by tribe
          </p>
          <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.12em] text-faint">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-3 rounded-full bg-ink" /> You
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-3 rounded-full bg-gold" />{" "}
              Others
            </span>
          </div>
        </div>
        <ul className="mt-6 flex flex-col gap-5">
          {rows.map((row) => {
            const accent = accentHex(getTribeBySlug(row.slug)?.color ?? "");
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
                  <CompareBar
                    label="You"
                    fill={row.selfScore / chartMax}
                    nonZero={row.selfScore > 0}
                    tone="ink"
                  />
                  <CompareBar
                    label="Others"
                    fill={row.othersScore / chartMax}
                    nonZero={row.othersScore > 0}
                    tone="gold"
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
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          The spread of opinion behind the &ldquo;others&rdquo; average. Every
          response is anonymous — no name, no relationship, just the top tribes
          each person read in you.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {perObserver.map((observer, i) => {
            const top = [...observer]
              .sort(byScore)
              .filter((s) => s.score > 0)
              .slice(0, 3);
            return (
              <div
                key={i}
                className="rounded-[2px] border border-hair p-5"
              >
                <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
                  Observer {i + 1}
                </p>
                {top.length > 0 ? (
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {top.map((s) => (
                      <li
                        key={s.slug}
                        className="flex items-baseline justify-between gap-3"
                      >
                        <TribeName slug={s.slug} name={s.name} />
                        <span className="text-[12px] tabular-nums text-faint">
                          {Math.round(s.score * 100)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-[14px] text-muted">
                    No clear tribe signal.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-14 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Back to your result
        </Link>
        {othersTop && (
          <Link
            href={`/tribes/${othersTop.slug}`}
            className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
          >
            Read the {othersTop.name} profile
          </Link>
        )}
      </div>
    </div>
  );
}

function CompareBar({
  label,
  fill,
  nonZero,
  tone,
}: {
  label: string;
  fill: number;
  nonZero: boolean;
  tone: "ink" | "gold";
}) {
  const color = tone === "ink" ? "var(--color-ink)" : "var(--color-gold)";
  return (
    <div className="flex items-center gap-3">
      <span className="w-[42px] shrink-0 text-[10px] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${Math.round(fill * 100)}% of the top score`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(fill * 100, nonZero ? 3 : 0)}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

function TribeName({ slug, name }: { slug: string; name: string }) {
  const accent = accentHex(getTribeBySlug(slug)?.color ?? "");
  return (
    <Link
      href={`/tribes/${slug}`}
      className="font-serif transition-opacity hover:opacity-70"
      style={{ color: accent }}
    >
      {name}
    </Link>
  );
}
