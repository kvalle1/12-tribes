import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import type { ProfileComparisonRow } from "@/lib/observer/aggregate";

/**
 * The self-vs-others comparison report (issue #9): the Subject's own profile
 * beside the equal-weight aggregate of anonymous Observers, tribe by tribe, with
 * the gap between them called out, followed by an anonymous per-Observer
 * drill-down. Presentational and client-safe — it receives already-scored plain
 * data (no `server-only` scoring imports), so the report page computes the
 * numbers on the server and this only draws them.
 */

/** A tribe reads as a real divergence when the two sides differ by at least this. */
const DIVERGENCE_THRESHOLD = 0.15;

export function ComparisonReport({
  rows,
  perObserver,
  observerCount,
}: {
  rows: ProfileComparisonRow[];
  perObserver: TribeScore[][];
  observerCount: number;
}) {
  // Scale every bar against the strongest score anywhere in the report so the
  // paired bars stay readable and comparable across both profiles.
  const max = rows.reduce((m, r) => Math.max(m, r.self, r.others), 0) || 1;

  const divergences = rows
    .filter((r) => Math.abs(r.delta) >= DIVERGENCE_THRESHOLD)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        You, and how others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        Your own profile beside the combined read of{" "}
        <span className="text-ink">{observerCount}</span>{" "}
        {observerCount === 1 ? "person" : "people"} who described you. Each
        observer counts equally, so no single voice dominates. The tribes where
        the two profiles pull apart are where the most useful insight lives.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] uppercase tracking-[0.14em] text-faint">
        <LegendSwatch className="bg-ink" label="You" />
        <LegendSwatch className="bg-gold/60" label="Others" />
      </div>

      {/* Paired bars — self vs others for all twelve tribes. */}
      <section className="mt-6">
        <ul className="flex flex-col gap-5">
          {rows.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            const diverges = Math.abs(row.delta) >= DIVERGENCE_THRESHOLD;
            return (
              <li key={row.slug} className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]">
                <div className="flex flex-col">
                  <span className="font-serif text-[17px] leading-tight" style={{ color: accent }}>
                    {row.name}
                  </span>
                  {diverges && (
                    <span className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-faint">
                      {row.delta > 0 ? "You read higher" : "Others read higher"}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Bar
                    fraction={row.self / max}
                    hasScore={row.self > 0}
                    color="var(--ink, #1a1a1a)"
                    ariaLabel={`${row.name}, you: ${Math.round(row.self * 100)} percent`}
                  />
                  <Bar
                    fraction={row.others / max}
                    hasScore={row.others > 0}
                    color={accent}
                    opacity={0.6}
                    ariaLabel={`${row.name}, others: ${Math.round(row.others * 100)} percent`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Where you and others diverge most — the growth edge. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Where you and others diverge
        </p>
        {divergences.length > 0 ? (
          <ul className="mt-5 flex flex-col gap-3">
            {divergences.map((row) => (
              <li key={row.slug} className="text-[15px] text-ink">
                <span className="font-serif text-[17px]">{row.name}</span>
                <span className="text-muted">
                  {" "}
                  — {row.delta > 0 ? "you see this in yourself more than others do" : "others see this in you more than you do"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 max-w-[520px] text-[15px] text-muted">
            You and the people who described you land in close agreement across
            all twelve tribes — a strongly aligned read.
          </p>
        )}
      </section>

      {/* Anonymous per-observer drill-down (Observer 1 / 2 / 3, no identity). */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each observer, anonymously
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          The individual reads behind the combined profile. Observers are never
          identified — only their top tribes are shown.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {perObserver.map((profile, i) => (
            <ObserverCard key={i} index={i} profile={profile} />
          ))}
        </div>
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

/** One observer's individual read, top tribes only, fully anonymous. */
function ObserverCard({ index, profile }: { index: number; profile: TribeScore[] }) {
  const top = [...profile]
    .sort((a, b) => b.score - a.score)
    .filter((s) => s.score > 0)
    .slice(0, 3);
  const max = top.length > 0 ? top[0].score : 1;

  return (
    <div className="rounded-[2px] border border-hair p-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
        Observer {index + 1}
      </div>
      {top.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2.5">
          {top.map((s) => {
            const tribe = getTribeBySlug(s.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li key={s.slug} className="grid grid-cols-[96px_1fr] items-center gap-3">
                <span className="font-serif text-[15px]" style={{ color: accent }}>
                  {s.name}
                </span>
                <Bar
                  fraction={s.score / max}
                  hasScore
                  color={accent}
                  ariaLabel={`Observer ${index + 1}, ${s.name}: ${Math.round(s.score * 100)} percent`}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-[13px] text-muted">No tribes scored.</p>
      )}
    </div>
  );
}

function Bar({
  fraction,
  hasScore,
  color,
  opacity = 1,
  ariaLabel,
}: {
  fraction: number;
  hasScore: boolean;
  color: string;
  opacity?: number;
  ariaLabel: string;
}) {
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={ariaLabel}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${Math.max(fraction * 100, hasScore ? 3 : 0)}%`,
          backgroundColor: color,
          opacity,
        }}
      />
    </div>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`inline-block h-2.5 w-6 rounded-full ${className}`} />
      {label}
    </span>
  );
}
