import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import {
  aggregateObservers,
  MIN_OBSERVERS_TO_UNLOCK,
} from "@/lib/assessment/aggregate-observers";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * beside the equal-weight "others" profile, with the tribes where the two views
 * diverge most called out, and an anonymous per-observer drill-down.
 *
 * It **unlocks only once at least three Observers have responded** — below that
 * the "others" view is neither meaningful nor safely anonymous, so a clear locked
 * state is shown instead.
 *
 * A server component: it imports the `server-only` scoring core and aggregator,
 * so the word→tribe mapping never reaches the client (ADR-0009). The Observer
 * responses arrive as bare word lists carrying no identity; the only label an
 * Observer gets here is a position number.
 */
export function ComparisonReport({
  selfWords,
  observerResponses,
}: {
  selfWords: string[];
  observerResponses: string[][];
}) {
  const { observerCount, others, perObserver } =
    aggregateObservers(observerResponses);

  if (observerCount < MIN_OBSERVERS_TO_UNLOCK) {
    return <LockedState count={observerCount} />;
  }

  const selfScores = score(selfWords);
  // Order the paired rows by the Subject's own ranking, so they read their own
  // profile top-down and see where others agree or diverge against it.
  const order = rankScores(selfScores).map((t) => t.slug);
  const selfBySlug = bySlug(selfScores);
  const othersBySlug = bySlug(others);

  // One shared scale for both bars so a longer "others" bar genuinely means a
  // higher normalized score, not a different axis.
  const scale = Math.max(
    ...selfScores.map((t) => t.score),
    ...others.map((t) => t.score),
    // Guard against an all-zero degenerate profile.
    Number.EPSILON,
  );

  const divergences = topDivergences(selfBySlug, othersBySlug, order);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Self vs. {observerCount} observers
      </p>
      <h1 className="mt-2 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.04]">
        How others see you
      </h1>
      <p className="mt-3 max-w-[540px] text-[15px] text-muted">
        Your own read is set beside the combined read of the people who described
        you. Each observer counts equally, however many words they picked.
      </p>

      {/* Self vs others, one paired row per tribe. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-center justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            You vs. others
          </p>
          <Legend />
        </div>
        <ul className="mt-6 flex flex-col gap-5">
          {order.map((slug) => {
            const tribe = getTribeBySlug(slug);
            const accent = accentHex(tribe?.color ?? "");
            const self = selfBySlug[slug]?.score ?? 0;
            const other = othersBySlug[slug]?.score ?? 0;
            return (
              <li
                key={slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <span className="font-serif text-[17px] leading-tight">
                  {tribe?.name ?? slug}
                </span>
                <div className="flex flex-col gap-2">
                  <PairBar
                    label="You"
                    value={self}
                    scale={scale}
                    accent={accent}
                    solid
                    tribeName={tribe?.name ?? slug}
                  />
                  <PairBar
                    label="Others"
                    value={other}
                    scale={scale}
                    accent={accent}
                    solid={false}
                    tribeName={tribe?.name ?? slug}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Where the two views pull apart most. */}
      {divergences.length > 0 && (
        <section className="mt-14 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where you and others diverge most
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            {divergences.map(({ slug, delta }) => {
              const tribe = getTribeBySlug(slug);
              const accent = accentHex(tribe?.color ?? "");
              const name = tribe?.name ?? slug;
              return (
                <li key={slug} className="flex items-baseline gap-2.5 text-[15px]">
                  <span
                    className="mt-[3px] inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: accent }}
                    aria-hidden
                  />
                  <span className="text-ink">
                    {delta > 0 ? (
                      <>
                        Others see more{" "}
                        <span className="font-semibold">{name}</span> in you than
                        you do.
                      </>
                    ) : (
                      <>
                        You lean more{" "}
                        <span className="font-semibold">{name}</span> than others
                        see.
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each observer, anonymously
        </p>
        <p className="mt-2 max-w-[540px] text-[14px] text-muted">
          The spread of opinion behind the average. Observers are unlabeled by
          design — no names, no relationships.
        </p>
        <ul className="mt-6 grid grid-cols-2 gap-5 max-[520px]:grid-cols-1">
          {perObserver.map((profile, index) => (
            <ObserverCard key={index} label={index + 1} profile={profile} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.12em] text-faint">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-4 rounded-full bg-ink" aria-hidden />
        You
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="inline-block h-2 w-4 rounded-full border border-ink/40"
          aria-hidden
        />
        Others
      </span>
    </div>
  );
}

function PairBar({
  label,
  value,
  scale,
  accent,
  solid,
  tribeName,
}: {
  label: string;
  value: number;
  scale: number;
  accent: string;
  solid: boolean;
  tribeName: string;
}) {
  const fraction = scale > 0 ? value / scale : 0;
  const width = value > 0 ? Math.max(fraction * 100, 3) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-[46px] shrink-0 text-[10px] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${tribeName}, ${label.toLowerCase()}: ${Math.round(
          fraction * 100,
        )}% of the strongest reading`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${width}%`,
            backgroundColor: solid ? accent : "transparent",
            border: solid ? undefined : `1.5px solid ${accent}`,
            opacity: solid ? 1 : 0.9,
          }}
        />
      </div>
    </div>
  );
}

function ObserverCard({
  label,
  profile,
}: {
  label: number;
  profile: TribeScore[];
}) {
  // The observer's own strongest few tribes — enough to show their leaning
  // without turning the drill-down into a second full chart.
  const top = rankScores(profile)
    .filter((t) => t.score > 0)
    .slice(0, 3);

  return (
    <li className="rounded-[3px] border border-hair bg-white/40 p-5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
        Observer {label}
      </p>
      {top.length === 0 ? (
        <p className="mt-3 text-[14px] text-muted">No clear leaning.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {top.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li key={row.slug} className="flex items-center gap-2.5">
                <span className="w-[76px] shrink-0 font-serif text-[15px] leading-tight">
                  {tribe?.name ?? row.slug}
                </span>
                <div
                  className="h-2 flex-1 overflow-hidden rounded-full bg-hair/50"
                  role="img"
                  aria-label={`${tribe?.name ?? row.slug}: ${Math.round(
                    row.relative * 100,
                  )}% of this observer's top tribe`}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(row.relative * 100, 3)}%`,
                      backgroundColor: accent,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function LockedState({ count }: { count: number }) {
  const remaining = MIN_OBSERVERS_TO_UNLOCK - count;
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        360 comparison
      </p>
      <h1 className="mt-2 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.04]">
        How others see you
      </h1>
      <div className="mt-8 rounded-[3px] border border-hair bg-white/40 p-8">
        <p className="text-[15px] text-ink">
          Your comparison unlocks once{" "}
          <span className="font-semibold">
            at least {MIN_OBSERVERS_TO_UNLOCK} people
          </span>{" "}
          have described you. This keeps the &ldquo;others&rdquo; view meaningful
          and every observer anonymous.
        </p>
        <p className="mt-4 text-[15px] text-muted">
          {count === 0
            ? "No one has responded yet."
            : count === 1
              ? "1 person has responded so far."
              : `${count} people have responded so far.`}{" "}
          {remaining === 1
            ? "1 more to go."
            : `${remaining} more to go.`}
        </p>
        <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-hair/50">
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{
              width: `${(count / MIN_OBSERVERS_TO_UNLOCK) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** Index a profile by slug for O(1) paired lookups. */
function bySlug(profile: TribeScore[]): Record<string, TribeScore> {
  return Object.fromEntries(profile.map((t) => [t.slug, t]));
}

/**
 * The tribes where the "others" reading pulls furthest from the Subject's own,
 * in either direction — at most three, and only where the gap is real.
 */
function topDivergences(
  self: Record<string, TribeScore>,
  others: Record<string, TribeScore>,
  order: string[],
): { slug: string; delta: number }[] {
  const MIN_GAP = 0.05;
  return order
    .map((slug) => ({
      slug,
      delta: (others[slug]?.score ?? 0) - (self[slug]?.score ?? 0),
    }))
    .filter((d) => Math.abs(d.delta) >= MIN_GAP)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);
}
