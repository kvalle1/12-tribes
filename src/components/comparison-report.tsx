"use client";

import { useMemo, useState } from "react";
import { accentHex, getTribeBySlug } from "@/lib/tribes";

/**
 * The 360 self-vs-others comparison view (issue #9). It shows the Subject's own
 * Strength Profile beside the equal-weight "others" profile, tribe by tribe, and
 * lets the Subject drill into any single Observer — anonymously (Observer 1, 2,
 * 3…, no attributes), so they can read the spread of opinion without being able
 * to tell who said what.
 *
 * It is a pure presentational client component: every number is computed on the
 * server by the scoring core + `aggregateObservers` and handed down as plain
 * per-tribe scores. No word→tribe mapping and no scoring logic crosses to the
 * client (ADR-0009). Tribe display data (name, accent colour) comes from the
 * client-safe `tribes` source.
 */

/** A per-tribe display score — the client-safe shape the report renders from. */
export interface TribeProfileScore {
  slug: string;
  name: string;
  score: number;
}

/** How close two scores must be (as a fraction of the chart's max) to read as "aligned". */
const ALIGNED_THRESHOLD = 0.08;

export function ComparisonReport({
  self,
  others,
  perObserver,
  primarySlug,
  secondarySlug,
}: {
  self: TribeProfileScore[];
  others: TribeProfileScore[];
  perObserver: TribeProfileScore[][];
  primarySlug: string;
  secondarySlug?: string | null;
}) {
  // -1 ⇒ the equal-weight aggregate ("Everyone"); 0..n-1 ⇒ a single Observer.
  const [source, setSource] = useState(-1);

  const activeOthers = source === -1 ? others : perObserver[source];

  // A single fixed scale across the Subject and every "others" view so bars
  // don't rescale when you toggle between Everyone and an individual Observer.
  const scaleMax = useMemo(() => {
    const all = [
      ...self.map((s) => s.score),
      ...others.map((s) => s.score),
      ...perObserver.flatMap((obs) => obs.map((s) => s.score)),
    ];
    const max = Math.max(0, ...all);
    return max > 0 ? max : 1;
  }, [self, others, perObserver]);

  const othersBySlug = useMemo(
    () => new Map(activeOthers.map((s) => [s.slug, s.score])),
    [activeOthers],
  );

  // Anchor the reading order on the Subject's own ranking, highest first.
  const rows = useMemo(
    () =>
      [...self]
        .sort((a, b) => b.score - a.score)
        .map((selfScore) => {
          const othersScore = othersBySlug.get(selfScore.slug) ?? 0;
          return {
            slug: selfScore.slug,
            name: selfScore.name,
            self: selfScore.score,
            others: othersScore,
            delta: othersScore - selfScore.score,
          };
        }),
    [self, othersBySlug],
  );

  // Highlight the sharpest agreement and disagreement in the current view,
  // among tribes that at least one side scored meaningfully.
  const { aligned, diverged } = useMemo(() => {
    const meaningful = rows.filter(
      (r) => Math.max(r.self, r.others) >= ALIGNED_THRESHOLD * scaleMax,
    );
    if (meaningful.length === 0) return { aligned: null, diverged: null };
    const byAgreement = [...meaningful].sort(
      (a, b) => Math.abs(a.delta) - Math.abs(b.delta),
    );
    return {
      aligned: byAgreement[0],
      diverged: byAgreement[byAgreement.length - 1],
    };
  }, [rows, scaleMax]);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Self vs 360
      </p>
      <h2 className="mt-2 font-serif text-[clamp(28px,5vw,40px)] font-semibold leading-[1.05]">
        How others see you
      </h2>
      <p className="mt-3 max-w-[560px] text-[15px] text-muted">
        Your own read is set beside how {perObserver.length} people who answered
        anonymously see you. The gap between them — where others rate a tribe
        higher or lower than you do — is where the most useful insight tends to
        live.
      </p>

      {/* Source toggle: the equal-weight aggregate, or any single Observer. */}
      <div
        className="mt-8 flex flex-wrap gap-2"
        role="group"
        aria-label="Choose whose view to compare against"
      >
        <SourceButton
          active={source === -1}
          onClick={() => setSource(-1)}
          label="Everyone"
        />
        {perObserver.map((_, i) => (
          <SourceButton
            key={i}
            active={source === i}
            onClick={() => setSource(i)}
            label={`Observer ${i + 1}`}
          />
        ))}
      </div>

      {/* Legend. */}
      <div className="mt-6 flex flex-wrap items-center gap-5 text-[12px] text-muted">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full bg-ink" />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full border border-ink/50 bg-ink/15" />
          {source === -1 ? "Others (all)" : `Observer ${source + 1}`}
        </span>
      </div>

      {/* Paired bars, one tribe per row. */}
      <ul className="mt-6 flex flex-col gap-5">
        {rows.map((row) => {
          const tribe = getTribeBySlug(row.slug);
          const accent = accentHex(tribe?.color ?? "");
          const role =
            row.slug === primarySlug
              ? "Primary"
              : row.slug === secondarySlug
                ? "Secondary"
                : null;
          return (
            <li
              key={row.slug}
              className="grid grid-cols-[120px_1fr_78px] items-center gap-4 max-[520px]:grid-cols-[92px_1fr_64px]"
            >
              <div className="flex items-baseline gap-2">
                <span
                  className="font-serif text-[17px] leading-none"
                  style={{ color: role ? accent : undefined }}
                >
                  {row.name}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <Bar
                  label={`You rate ${row.name}`}
                  fraction={row.self / scaleMax}
                  color={accent}
                  variant="self"
                />
                <Bar
                  label={`${
                    source === -1 ? "Others" : `Observer ${source + 1}`
                  } rate ${row.name}`}
                  fraction={row.others / scaleMax}
                  color={accent}
                  variant="others"
                />
              </div>

              <DeltaTag delta={row.delta} scaleMax={scaleMax} name={row.name} />
            </li>
          );
        })}
      </ul>

      {/* Where you agree / diverge most in the current view. */}
      {aligned && diverged && (
        <div className="mt-12 grid gap-4 border-t border-hair pt-8 sm:grid-cols-2">
          <Highlight
            heading="Most aligned"
            body={`You and ${
              source === -1 ? "the group" : `Observer ${source + 1}`
            } see ${aligned.name} most alike.`}
            slug={aligned.slug}
          />
          <Highlight
            heading="Biggest gap"
            body={
              diverged.delta >= 0
                ? `${
                    source === -1 ? "Others" : `Observer ${source + 1}`
                  } read ${diverged.name} more strongly in you than you do.`
                : `You read ${diverged.name} more strongly in yourself than ${
                    source === -1 ? "others" : `Observer ${source + 1}`
                  } do.`
            }
            slug={diverged.slug}
          />
        </div>
      )}
    </div>
  );
}

function SourceButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "rounded-[2px] bg-ink px-4 py-2 text-[12px] uppercase tracking-[0.12em] text-bone"
          : "rounded-[2px] border border-hair px-4 py-2 text-[12px] uppercase tracking-[0.12em] text-muted transition-colors hover:border-ink hover:text-ink"
      }
    >
      {label}
    </button>
  );
}

function Bar({
  label,
  fraction,
  color,
  variant,
}: {
  label: string;
  fraction: number;
  color: string;
  variant: "self" | "others";
}) {
  const pct = Math.round(fraction * 100);
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={`${label}: ${pct}% of the top score`}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${Math.max(fraction * 100, fraction > 0 ? 3 : 0)}%`,
          backgroundColor: variant === "self" ? color : "transparent",
          border: variant === "others" ? `1.5px solid ${color}` : undefined,
          opacity: variant === "self" ? 1 : 0.85,
        }}
      />
    </div>
  );
}

function DeltaTag({
  delta,
  scaleMax,
  name,
}: {
  delta: number;
  scaleMax: number;
  name: string;
}) {
  const magnitude = Math.abs(delta) / scaleMax;
  if (magnitude < ALIGNED_THRESHOLD) {
    return (
      <span
        className="text-right text-[11px] uppercase tracking-[0.12em] text-faint"
        aria-label={`You and this view agree on ${name}`}
      >
        Aligned
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span
      className={`text-right text-[11px] uppercase tracking-[0.12em] ${
        up ? "text-gold" : "text-muted"
      }`}
      aria-label={
        up
          ? `Others rate ${name} higher than you`
          : `You rate ${name} higher than others`
      }
    >
      {up ? "▲ others" : "▼ you"}
    </span>
  );
}

function Highlight({
  heading,
  body,
  slug,
}: {
  heading: string;
  body: string;
  slug: string;
}) {
  const tribe = getTribeBySlug(slug);
  const accent = accentHex(tribe?.color ?? "");
  return (
    <div className="rounded-[2px] border border-hair p-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
        {heading}
      </div>
      <div
        className="mt-2 font-serif text-[20px] font-semibold"
        style={{ color: accent }}
      >
        {tribe?.name ?? slug}
      </div>
      <p className="mt-1 text-[14px] text-muted">{body}</p>
    </div>
  );
}
