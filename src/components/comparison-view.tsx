import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import { compareProfiles } from "@/lib/observer/comparison";
import type { ObserverAggregate } from "@/lib/observer/aggregate";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own Strength
 * Profile shown beside the equal-weight aggregated "others" profile, with the
 * points of agreement and divergence called out, plus an anonymous per-observer
 * drill-down (Observer 1/2/3…).
 *
 * Server component: it recomputes the Subject's profile from their saved `words`
 * via the `server-only` scoring core (the word→tribe mapping never reaches the
 * client, ADR-0009), exactly as `ResultView` does, so the two views can never
 * drift. The observer aggregate is computed on the server and passed in.
 */
export function ComparisonView({
  selfWords,
  aggregate,
}: {
  selfWords: string[];
  aggregate: ObserverAggregate;
}) {
  const selfScores = score(selfWords);
  const rows = compareProfiles(selfScores, aggregate.scores);

  const selfTop = rankScores(selfScores)[0];
  const othersTop = rankScores(aggregate.scores)[0];
  const agrees = selfTop && othersTop && selfTop.slug === othersTop.slug;

  const divergences = rows.filter((r) => r.diverges);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        The 360 read · {aggregate.observerCount}{" "}
        {aggregate.observerCount === 1 ? "observer" : "observers"}
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        How others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Your own read sits beside the anonymous, equal-weight average of everyone
        who described you — each observer counts the same, no matter how many
        words they picked.
      </p>

      {/* Headline agreement / divergence. */}
      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[3px] border border-hair bg-white/40 p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-faint">
            Where you agree
          </p>
          {agrees ? (
            <p className="mt-2 text-[15px] leading-snug text-ink">
              You and your observers both lead with{" "}
              <span
                className="font-serif text-[18px]"
                style={{ color: accentHex(getTribeBySlug(selfTop.slug)?.color ?? "") }}
              >
                {selfTop.name}
              </span>
              .
            </p>
          ) : (
            <p className="mt-2 text-[15px] leading-snug text-muted">
              You lead with{" "}
              <span className="font-serif text-[17px] text-ink">
                {selfTop?.name}
              </span>
              ; your observers lead with{" "}
              <span className="font-serif text-[17px] text-ink">
                {othersTop?.name}
              </span>
              .
            </p>
          )}
        </div>
        <div className="rounded-[3px] border border-hair bg-white/40 p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-faint">
            Where they see you differently
          </p>
          {divergences.length > 0 ? (
            <p className="mt-2 text-[15px] leading-snug text-ink">
              {divergences.map((r) => r.name).join(", ")}
            </p>
          ) : (
            <p className="mt-2 text-[15px] leading-snug text-muted">
              No large gaps — their read closely tracks your own.
            </p>
          )}
        </div>
      </section>

      {/* Self vs others bars, tribe by tribe. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-baseline justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            You vs. others
          </p>
          <p className="flex items-center gap-4 text-[11px] uppercase tracking-[0.12em] text-faint">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink" />
              You
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-gold" />
              Others
            </span>
          </p>
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
                <div className="flex items-center gap-2">
                  <span className="font-serif text-[17px] leading-none">
                    {row.name}
                  </span>
                  {row.diverges && (
                    <span
                      className="text-[9px] uppercase tracking-[0.12em] text-gold"
                      title="You and your observers see this tribe differently"
                    >
                      ✦
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Bar
                    fraction={row.selfFraction}
                    filled={row.selfScore > 0}
                    color="var(--ink)"
                    label={`You — ${row.name}: ${Math.round(row.selfFraction * 100)}% of the top score`}
                  />
                  <Bar
                    fraction={row.othersFraction}
                    filled={row.othersScore > 0}
                    color={accent}
                    label={`Others — ${row.name}: ${Math.round(row.othersFraction * 100)}% of the top score`}
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
          Every response is fully anonymous — labelled only by order, never by who
          sent it.
        </p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {aggregate.perObserver.map((profile, index) => {
            const top = rankScores(profile)
              .filter((r) => r.score > 0)
              .slice(0, 3);
            return (
              <li
                key={index}
                className="rounded-[3px] border border-hair bg-white/40 p-5"
              >
                <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
                  Observer {index + 1}
                </p>
                <ul className="mt-3 flex flex-col gap-2">
                  {top.map((r) => {
                    const accent = accentHex(getTribeBySlug(r.slug)?.color ?? "");
                    return (
                      <li key={r.slug} className="flex items-center gap-3">
                        <span className="w-[92px] shrink-0 font-serif text-[15px]">
                          {r.name}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-hair/50">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(r.relative * 100, 4)}%`,
                              backgroundColor: accent,
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
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
          ← Back to your result
        </Link>
      </div>
    </div>
  );
}

function Bar({
  fraction,
  filled,
  color,
  label,
}: {
  fraction: number;
  filled: boolean;
  color: string;
  label: string;
}) {
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${Math.max(fraction * 100, filled ? 3 : 0)}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}
