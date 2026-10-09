import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import { aggregateObservers } from "@/lib/observer/aggregate";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile
 * shown alongside the equal-weight "others" profile aggregated from their
 * anonymous Observers, with the sharpest alignments and divergences called out
 * and a fully anonymous per-observer drill-down ("Observer 1/2/3", no
 * attributes).
 *
 * This is a server component: it imports the `server-only` scoring core and the
 * observer aggregation, so the word→tribe mapping never reaches the client
 * (ADR-0009). Render it only from server components, and only once the report is
 * unlocked (≥3 Observers) — the locked state is handled by the page.
 */
export function ComparisonView({
  words,
  primarySlug,
  secondarySlug,
  observerWordLists,
}: {
  /** The Subject's own selected words (their Self Assessment). */
  words: string[];
  primarySlug: string;
  secondarySlug?: string | null;
  /** One entry per anonymous Observer response, oldest first. */
  observerWordLists: string[][];
}) {
  const selfScores = score(words);
  const othersScores = aggregateObservers(observerWordLists);

  const othersBySlug = bySlug(othersScores);

  // Put self and others on one shared visual scale so the two bars are directly
  // comparable — a longer "others" bar genuinely means others rate it higher.
  const sharedMax = Math.max(
    ...selfScores.map((s) => s.score),
    ...othersScores.map((s) => s.score),
    0,
  );
  const fill = (value: number) => (sharedMax > 0 ? value / sharedMax : 0);

  const rows = selfScores
    .map((s) => {
      const self = s.score;
      const others = othersBySlug.get(s.slug) ?? 0;
      return { slug: s.slug, name: s.name, self, others, delta: others - self };
    })
    // Most salient tribes first: whichever side rates the tribe highest.
    .sort((a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others));

  const othersTop = rankScores(othersScores).find((r) => r.score > 0);
  const insights = deriveInsights(rows);

  // Per-observer drill-down, ordered by *content* rather than arrival time, so
  // the card order carries no timing signal. The locked page already reveals a
  // running response count; if the cards were ordered oldest-first the Subject
  // could map the newest card onto whoever just replied, undoing the anonymity
  // ADR-0003 promises. Sorting by the normalized profile (and relabelling 1…N
  // from that order) is deterministic across loads and timing-free.
  const anonymizedObservers = observerWordLists
    .map((words) => ({ scores: score(words) }))
    .sort((a, b) => compareProfiles(a.scores, b.scores));

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        How others see you
      </p>

      <h1 className="mt-3 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.05]">
        You &amp; your {observerWordLists.length} observers
      </h1>

      <p className="mt-4 max-w-[560px] text-[16px] leading-relaxed text-muted">
        Your own read is <TribeName slug={primarySlug} />;{" "}
        {othersTop ? (
          <>
            the people who know you lean most toward{" "}
            <TribeName slug={othersTop.slug} />.
          </>
        ) : (
          "your observers haven't pointed anywhere clear yet."
        )}{" "}
        The gap between the two is where growth tends to live.
      </p>

      {/* Alignment & divergence — the headline of a 360 read. */}
      {insights.length > 0 && (
        <section className="mt-12 grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
          {insights.map((insight) => (
            <div
              key={insight.key}
              className="rounded-[2px] border border-hair p-5"
              style={
                { "--accent": accentHex(colorFor(insight.slug)) } as React.CSSProperties
              }
            >
              <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
                {insight.label}
              </p>
              <p className="mt-2 font-serif text-[22px] leading-tight">
                <span style={{ color: "var(--accent)" }}>
                  {getTribeBySlug(insight.slug)?.name ?? insight.slug}
                </span>
              </p>
              <p className="mt-2 text-[14px] leading-snug text-muted">
                {insight.detail}
              </p>
            </div>
          ))}
        </section>
      )}

      {/* Side-by-side bars for all twelve tribes. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-baseline justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Your read vs. theirs
          </p>
          <p className="flex items-center gap-4 text-[11px] uppercase tracking-[0.14em] text-faint">
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

        <ul className="mt-7 flex flex-col gap-6">
          {rows.map((row) => {
            const role =
              row.slug === primarySlug
                ? "Primary"
                : row.slug === secondarySlug
                  ? "Secondary"
                  : null;
            return (
              <li
                key={row.slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className="font-serif text-[17px] leading-none"
                    style={{ color: role ? accentHex(colorFor(row.slug)) : undefined }}
                  >
                    {row.name}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <CompareBar
                    label={`You rate ${row.name}`}
                    fill={fill(row.self)}
                    present={row.self > 0}
                    colorClass="bg-ink"
                  />
                  <CompareBar
                    label={`Your observers rate ${row.name}`}
                    fill={fill(row.others)}
                    present={row.others > 0}
                    colorClass="bg-gold"
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
          Observer by observer
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Each observer&rsquo;s own read, shown anonymously and in no particular
          order — a column is a reading, never a name.
        </p>
        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          {anonymizedObservers.map((observer, i) => (
            <ObserverCard key={i} index={i + 1} scores={observer.scores} />
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

function CompareBar({
  label,
  fill,
  present,
  colorClass,
}: {
  label: string;
  fill: number;
  present: boolean;
  colorClass: string;
}) {
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={`${label}: ${Math.round(fill * 100)}% of the strongest signal`}
    >
      <div
        className={`h-full rounded-full ${colorClass} transition-[width]`}
        style={{ width: `${Math.max(fill * 100, present ? 3 : 0)}%` }}
      />
    </div>
  );
}

function ObserverCard({
  index,
  scores,
}: {
  index: number;
  scores: TribeScore[];
}) {
  const top = rankScores(scores)
    .filter((r) => r.score > 0)
    .slice(0, 3);

  return (
    <div className="rounded-[2px] border border-hair p-5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
        Observer {index}
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {top.map((row) => (
          <li key={row.slug} className="grid grid-cols-[96px_1fr] items-center gap-3">
            <span className="font-serif text-[15px] leading-none">{row.name}</span>
            <div className="h-2 overflow-hidden rounded-full bg-hair/50">
              <div
                className="h-full rounded-full transition-[width]"
                style={{
                  width: `${Math.max(row.relative * 100, 3)}%`,
                  backgroundColor: accentHex(colorFor(row.slug)),
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TribeName({ slug }: { slug: string }) {
  const tribe = getTribeBySlug(slug);
  return (
    <span style={{ color: accentHex(tribe?.color ?? "") }}>
      {tribe?.name ?? slug}
    </span>
  );
}

/** The Tailwind color name for a tribe slug, for `accentHex`. */
function colorFor(slug: string): string {
  return getTribeBySlug(slug)?.color ?? "";
}

function bySlug(scores: TribeScore[]): Map<string, number> {
  return new Map(scores.map((s) => [s.slug, s.score]));
}

/**
 * Order two observer profiles deterministically by content alone — walk the
 * canonical-order score vectors and sort the higher score first at the first
 * tribe they differ on. Carries no arrival-time information, so the drill-down's
 * "Observer 1…N" labels can't be mapped back to who responded when (ADR-0003).
 */
function compareProfiles(a: TribeScore[], b: TribeScore[]): number {
  for (let i = 0; i < a.length; i++) {
    if (b[i].score !== a[i].score) return b[i].score - a[i].score;
  }
  return 0;
}

interface Insight {
  key: string;
  slug: string;
  label: string;
  detail: string;
}

/**
 * Pull the two sharpest divergences and the strongest shared read out of the
 * per-tribe rows, so the report leads with meaning rather than twelve bars.
 *
 * - "They see more" — the tribe others rate furthest above the Subject (a
 *   strength the Subject under-claims).
 * - "You lean on this more" — the tribe the Subject rates furthest above others
 *   (something others don't see as strongly).
 * - "You agree here" — among tribes both sides rate meaningfully, the one where
 *   the two reads are closest.
 *
 * Each tribe appears at most once; an insight is emitted only when the gap (or
 * agreement) is real, so a near-identical read simply yields fewer cards.
 */
function deriveInsights(
  rows: { slug: string; name: string; self: number; others: number; delta: number }[],
): Insight[] {
  const MEANINGFUL = 0.05; // ignore noise near zero
  const insights: Insight[] = [];
  const used = new Set<string>();

  const underclaim = [...rows]
    .filter((r) => r.delta > MEANINGFUL)
    .sort((a, b) => b.delta - a.delta)[0];
  if (underclaim) {
    used.add(underclaim.slug);
    insights.push({
      key: "underclaim",
      slug: underclaim.slug,
      label: "They see more",
      detail: `Your observers read ${underclaim.name} in you more strongly than you do.`,
    });
  }

  const overclaim = [...rows]
    .filter((r) => -r.delta > MEANINGFUL && !used.has(r.slug))
    .sort((a, b) => a.delta - b.delta)[0];
  if (overclaim) {
    used.add(overclaim.slug);
    insights.push({
      key: "overclaim",
      slug: overclaim.slug,
      label: "You lean on this more",
      detail: `You rate ${overclaim.name} in yourself higher than your observers do.`,
    });
  }

  const agreement = [...rows]
    .filter(
      (r) =>
        !used.has(r.slug) &&
        r.self > MEANINGFUL &&
        r.others > MEANINGFUL &&
        Math.abs(r.delta) <= MEANINGFUL,
    )
    .sort((a, b) => b.self + b.others - (a.self + a.others))[0];
  if (agreement) {
    insights.push({
      key: "agreement",
      slug: agreement.slug,
      label: "You agree here",
      detail: `You and your observers both read ${agreement.name} about the same.`,
    });
  }

  return insights;
}
