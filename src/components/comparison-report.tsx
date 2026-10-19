import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score, deriveResult, type TribeScore } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import { aggregateObservers } from "@/lib/assessment/aggregate";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). Shows the
 * Subject's own normalized profile beside the equal-weight "others" profile
 * aggregated from Observer responses, calls out where the two agree and where
 * they diverge, and offers an anonymous per-observer drill-down.
 *
 * A server component: it imports the scoring core and aggregation, both
 * `server-only` (the word→tribe mapping never reaches the client, ADR-0009), and
 * recomputes everything from raw words so the report can never drift from the
 * stored selections. Render it only from server components, and only once the
 * report has unlocked (≥3 Observers) — the locked state is handled upstream.
 */
export function ComparisonReport({
  selfWords,
  responses,
}: {
  selfWords: string[];
  responses: string[][];
}) {
  const selfScores = score(selfWords);
  const agg = aggregateObservers(responses);

  const othersBy = scoreLookup(agg.average);

  // One row per tribe carrying both profiles, ordered by the stronger of the two
  // signals so the tribes that matter most sit at the top. A shared scale across
  // both profiles keeps the two bars honestly comparable.
  const rows = selfScores
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      self: s.score,
      others: othersBy(s.slug),
    }))
    .sort((a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others));
  const scale = Math.max(...rows.flatMap((r) => [r.self, r.others]), 0);

  const selfTop = deriveResult(selfScores).primary;
  const othersTop = deriveResult(agg.average).primary;
  const aligned = selfTop.slug === othersTop.slug;

  // The sharpest disagreement: the tribe where self and others differ most. A
  // small gap is noise — averaging N observers dilutes any single peak — so the
  // callout only speaks up when the gap clears a modest threshold.
  const divergence = [...rows].sort(
    (a, b) => Math.abs(b.self - b.others) - Math.abs(a.self - a.others),
  )[0];
  const DIVERGENCE_THRESHOLD = 0.12;
  const hasDivergence =
    !!divergence &&
    Math.abs(divergence.self - divergence.others) >= DIVERGENCE_THRESHOLD;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read · {agg.observerCount}{" "}
        {agg.observerCount === 1 ? "observer" : "observers"}
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.05]">
        How others see you
      </h1>

      {/* The headline alignment / divergence story. */}
      <section className="mt-8 flex flex-col gap-3">
        <p className="text-[16px] leading-relaxed text-ink">
          {aligned ? (
            <>
              You and the people who know you agree: your Primary reads as{" "}
              <TribeName slug={selfTop.slug} />.
            </>
          ) : (
            <>
              You lead with <TribeName slug={selfTop.slug} />, but others see{" "}
              <TribeName slug={othersTop.slug} /> most strongly — worth sitting
              with.
            </>
          )}
        </p>
        {hasDivergence && (
          <p className="text-[15px] leading-relaxed text-muted">
            The widest gap is <TribeName slug={divergence.slug} />:{" "}
            {divergence.others > divergence.self
              ? "others see more of it in you than you do"
              : "you claim more of it than others see"}
            .
          </p>
        )}
      </section>

      {/* Self vs others, side by side, for all twelve tribes. */}
      <section className="mt-12 border-t border-hair pt-8">
        <div className="flex items-center justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Self vs. others
          </p>
          <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.14em] text-faint">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink" />
              You
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full border border-ink/40 bg-ink/25" />
              Others
            </span>
          </div>
        </div>

        <ul className="mt-6 flex flex-col gap-5">
          {rows.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            const role =
              row.slug === selfTop.slug
                ? "Your primary"
                : row.slug === othersTop.slug
                  ? "Their primary"
                  : null;
            return (
              <li key={row.slug} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between">
                  <span
                    className="font-serif text-[17px] leading-none"
                    style={{ color: role ? accent : undefined }}
                  >
                    {row.name}
                  </span>
                  {role && (
                    <span className="text-[10px] uppercase tracking-[0.14em] text-faint">
                      {role}
                    </span>
                  )}
                </div>
                <CompareBar
                  label={`${row.name}, you`}
                  value={row.self}
                  scale={scale}
                  accent={accent}
                  variant="self"
                />
                <CompareBar
                  label={`${row.name}, others`}
                  value={row.others}
                  scale={scale}
                  accent={accent}
                  variant="others"
                />
              </li>
            );
          })}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down — Observer 1 … N, no identities. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Each response stays anonymous — no names, no relationships. Here is the
          spread of how your {agg.observerCount} observers each read you.
        </p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {agg.perObserver.map((profile, i) => (
            <ObserverCard key={i} index={i} profile={profile} />
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

/** A labelled lookup from a scored profile: slug → normalized score. */
function scoreLookup(scores: readonly TribeScore[]) {
  const map = new Map(scores.map((s) => [s.slug, s.score]));
  return (slug: string) => map.get(slug) ?? 0;
}

function TribeName({ slug }: { slug: string }) {
  const tribe = getTribeBySlug(slug);
  if (!tribe) return <span>{slug}</span>;
  return (
    <Link
      href={`/tribes/${tribe.slug}`}
      className="font-medium text-ink underline decoration-gold/50 underline-offset-2 transition-colors hover:text-gold"
      style={{ color: accentHex(tribe.color) }}
    >
      {tribe.name}
    </Link>
  );
}

/**
 * One comparison bar. Self bars are solid accent; others bars are the same hue
 * at lower weight with an outline, so the two read as the same tribe seen two
 * ways. Width is relative to the shared `scale` across both profiles.
 */
function CompareBar({
  label,
  value,
  scale,
  accent,
  variant,
}: {
  label: string;
  value: number;
  scale: number;
  accent: string;
  variant: "self" | "others";
}) {
  const fraction = scale > 0 ? value / scale : 0;
  const width = Math.max(fraction * 100, value > 0 ? 3 : 0);
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={`${label}: ${Math.round(value * 100)}%`}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={
          variant === "self"
            ? { width: `${width}%`, backgroundColor: accent }
            : {
                width: `${width}%`,
                backgroundColor: accent,
                opacity: 0.4,
                boxShadow: `inset 0 0 0 1px ${accent}`,
              }
        }
      />
    </div>
  );
}

/** An anonymous single-observer summary: their top tribes, no identity. */
function ObserverCard({
  index,
  profile,
}: {
  index: number;
  profile: TribeScore[];
}) {
  const top = rankScores(profile).filter((r) => r.score > 0);
  const primary = deriveResult(profile).primary;
  const shown = top.slice(0, 3);
  return (
    <li className="rounded-[2px] border border-hair bg-white/40 px-4 py-3.5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
        Observer {index + 1}
      </p>
      {shown.length === 0 ? (
        <p className="mt-2 text-[14px] text-muted">No clear signal.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {shown.map((r) => {
            const tribe = getTribeBySlug(r.slug);
            const accent = accentHex(tribe?.color ?? "");
            const isPrimary = r.slug === primary.slug;
            return (
              <li key={r.slug} className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: accent, opacity: isPrimary ? 1 : 0.5 }}
                />
                <span
                  className="font-serif text-[15px]"
                  style={{ color: isPrimary ? accent : undefined }}
                >
                  {r.name}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
