import { accentHex, getTribeBySlug, tribes } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import {
  aggregateObservers,
  type ObserverResponseInput,
} from "@/lib/observer/aggregate";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * beside the equal-weight aggregated "others" profile, with the tribes where the
 * two reads agree and diverge called out, and an anonymous per-Observer
 * drill-down (Observer 1/2/3…).
 *
 * Server component: it imports the `server-only` scoring core (the word→tribe
 * mapping never reaches the client, ADR-0009) and the equal-weight aggregation.
 * Render it only from server components. Callers gate on the ≥3-Observer unlock
 * before rendering this; it assumes it has enough responses to be meaningful.
 */
export function ComparisonReport({
  selfWords,
  responses,
}: {
  selfWords: string[];
  responses: ObserverResponseInput[];
}) {
  const selfProfile = score(selfWords);
  const { others, perObserver, count } = aggregateObservers(responses);

  // A shared scale so the "You" and "Others" bars are directly comparable in
  // length across the whole report.
  const maxScore = Math.max(
    0,
    ...selfProfile.map((t) => t.score),
    ...others.map((t) => t.score),
  );

  // One row per tribe, ordered by how prominent the tribe is in either read, so
  // the tribes that matter to this comparison sit at the top.
  const rows = tribes
    .map((tribe, i) => ({
      slug: tribe.slug,
      name: tribe.name,
      self: selfProfile[i].score,
      others: others[i].score,
      divergence: others[i].score - selfProfile[i].score,
    }))
    .sort((a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others));

  // Where the two reads agree most: the tribe both rate highest (largest of the
  // smaller of the two scores), and where they diverge most: the largest gap.
  const agreement =
    maxScore > 0
      ? [...rows].sort(
          (a, b) => Math.min(b.self, b.others) - Math.min(a.self, a.others),
        )[0]
      : null;
  const divergence =
    maxScore > 0
      ? [...rows].sort(
          (a, b) => Math.abs(b.divergence) - Math.abs(a.divergence),
        )[0]
      : null;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 · {count} {count === 1 ? "response" : "responses"}
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        How others see you
      </h1>
      <p className="mt-4 max-w-[540px] text-[15px] text-muted">
        Your own word selection set beside the combined read of the people who
        described you. Each Observer counts equally, however many words they
        picked.
      </p>

      {(agreement || divergence) && (
        <section className="mt-10 grid gap-4 sm:grid-cols-2">
          {agreement && agreement.self > 0 && agreement.others > 0 && (
            <Callout
              label="Where you align"
              accent={accentHex(getTribeBySlug(agreement.slug)?.color ?? "")}
              body={
                <>
                  You and they both land on{" "}
                  <strong className="font-semibold">{agreement.name}</strong>.
                </>
              }
            />
          )}
          {divergence && Math.abs(divergence.divergence) > 0.0001 && (
            <Callout
              label="Biggest difference"
              accent={accentHex(getTribeBySlug(divergence.slug)?.color ?? "")}
              body={
                divergence.divergence > 0 ? (
                  <>
                    Others see more{" "}
                    <strong className="font-semibold">
                      {divergence.name}
                    </strong>{" "}
                    in you than you named yourself.
                  </>
                ) : (
                  <>
                    You read yourself as more{" "}
                    <strong className="font-semibold">
                      {divergence.name}
                    </strong>{" "}
                    than others did.
                  </>
                )
              }
            />
          )}
        </section>
      )}

      {/* Self vs aggregated-others, side by side, per tribe. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-center justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            You vs the group
          </p>
          <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.14em] text-faint">
            <LegendSwatch label="You" solid />
            <LegendSwatch label={`Others (${count})`} />
          </div>
        </div>

        <ul className="mt-7 flex flex-col gap-5">
          {rows.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li
                key={row.slug}
                className="grid grid-cols-[110px_1fr] items-center gap-4 max-[520px]:grid-cols-[88px_1fr]"
              >
                <span className="font-serif text-[17px] leading-tight">
                  {row.name}
                </span>
                <div className="flex flex-col gap-1.5">
                  <CompareBar
                    label="You"
                    relative={maxScore > 0 ? row.self / maxScore : 0}
                    present={row.self > 0}
                    accent={accent}
                    solid
                  />
                  <CompareBar
                    label="Others"
                    relative={maxScore > 0 ? row.others / maxScore : 0}
                    present={row.others > 0}
                    accent={accent}
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
          Each response
        </p>
        <p className="mt-2 max-w-[540px] text-[14px] text-muted">
          Every response is fully anonymous — there&rsquo;s no way to tell who is
          who. Open one to see the tribes that response leaned toward.
        </p>
        <ul className="mt-6 flex flex-col gap-2.5">
          {perObserver.map((profile, i) => {
            const top = rankScores(profile)
              .filter((t) => t.score > 0)
              .slice(0, 3);
            return (
              <li key={i}>
                <details className="group rounded-[2px] border border-hair px-5 py-3.5">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] font-medium">
                    <span>Observer {i + 1}</span>
                    <span className="text-[11px] uppercase tracking-[0.14em] text-faint transition-transform group-open:rotate-90">
                      →
                    </span>
                  </summary>
                  <div className="mt-4 flex flex-wrap gap-2.5">
                    {top.length === 0 && (
                      <span className="text-[14px] text-muted">
                        No clear lean.
                      </span>
                    )}
                    {top.map((t) => {
                      const tribe = getTribeBySlug(t.slug);
                      const accent = accentHex(tribe?.color ?? "");
                      return (
                        <span
                          key={t.slug}
                          className="rounded-[2px] border px-3.5 py-1.5 text-[14px] text-ink"
                          style={{
                            borderColor: `${accent}66`,
                            backgroundColor: `${accent}14`,
                          }}
                        >
                          {t.name}
                        </span>
                      );
                    })}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Callout({
  label,
  body,
  accent,
}: {
  label: string;
  body: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-[2px] border border-hair p-5">
      <p
        className="text-[11px] uppercase tracking-[0.16em]"
        style={{ color: accent }}
      >
        {label}
      </p>
      <p className="mt-2 text-[15px] leading-snug text-ink">{body}</p>
    </div>
  );
}

function LegendSwatch({
  label,
  solid = false,
}: {
  label: string;
  solid?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full bg-ink"
        style={{ opacity: solid ? 1 : 0.4 }}
        aria-hidden
      />
      {label}
    </span>
  );
}

function CompareBar({
  label,
  relative,
  present,
  accent,
  solid = false,
}: {
  label: string;
  relative: number;
  present: boolean;
  accent: string;
  solid?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-[46px] shrink-0 text-[10px] uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${Math.round(relative * 100)}% of the top score`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(relative * 100, present ? 3 : 0)}%`,
            backgroundColor: accent,
            opacity: solid ? 1 : 0.5,
          }}
        />
      </div>
    </div>
  );
}
