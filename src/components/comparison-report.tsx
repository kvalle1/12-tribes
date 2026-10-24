import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { deriveResult, score, type TribeScore } from "@/lib/assessment/score";
import { aggregateObservers } from "@/lib/observer/aggregate";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile
 * alongside the equal-weight "others" profile, the places they align and
 * diverge, and an anonymous per-observer drill-down.
 *
 * Like `ResultView`, it renders from raw words and recomputes everything through
 * the pure scoring core, so the report can never drift from the stored
 * selections. The "others" profile is the mean of each observer's
 * individually-normalized scores (`aggregateObservers`), so self and others sit
 * on the same 0–1 scale and the gap between them is meaningful.
 *
 * This is a server component: it imports the scoring core and the aggregation,
 * both `server-only` (the word→tribe mapping never reaches the client,
 * ADR-0009). Render it only from server components, and only once the report has
 * unlocked (≥3 observers) — the page owns that gate.
 */
export function ComparisonReport({
  selfWords,
  observerWordLists,
}: {
  selfWords: string[];
  observerWordLists: string[][];
}) {
  const selfScores = score(selfWords);
  const { average, perObserver, observerCount } =
    aggregateObservers(observerWordLists);

  // Zip self and others by index — both are in canonical (tribe `number`) order.
  const rows: ComparisonRow[] = selfScores.map((self, i) => ({
    slug: self.slug,
    name: self.name,
    self: self.score,
    others: average[i].score,
    gap: self.score - average[i].score,
  }));

  // One shared scale for both profiles so a taller self bar genuinely means a
  // higher score than a shorter others bar — divergence is visible, not hidden
  // by per-profile normalization.
  const sharedMax = Math.max(...rows.map((r) => Math.max(r.self, r.others)), 0);
  const ranked = [...rows].sort(
    (a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others),
  );

  const selfTop = deriveResult(selfScores).primary;
  const othersTop = deriveResult(average).primary;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 · {observerCount}{" "}
        {observerCount === 1 ? "observer" : "observers"}
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.04]">
        How others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
        You see yourself as{" "}
        <TribeName slug={selfTop.slug} />. Those who answered most see{" "}
        <TribeName slug={othersTop.slug} />. Where the two columns agree you have
        confirmation; where they part, you have something worth looking at.
      </p>

      {/* Self vs others, side by side, on one shared scale. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-center justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            You vs others
          </p>
          <p className="flex items-center gap-4 text-[11px] uppercase tracking-[0.14em] text-faint">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink" />
              You
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full border border-ink/40 bg-ink/25" />
              Others
            </span>
          </p>
        </div>

        <ul className="mt-7 flex flex-col gap-5">
          {ranked.map((row) => {
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
                    label={`You · ${row.name}`}
                    value={row.self}
                    sharedMax={sharedMax}
                    accent={accent}
                    variant="self"
                  />
                  <CompareBar
                    label={`Others · ${row.name}`}
                    value={row.others}
                    sharedMax={sharedMax}
                    accent={accent}
                    variant="others"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Where the two reads agree and where they diverge. */}
      <AlignmentDivergence rows={rows} />

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Each response, kept anonymous. No names, no relationships — just how
          each person who answered reads you.
        </p>
        <ul className="mt-6 grid grid-cols-2 gap-4 max-[520px]:grid-cols-1">
          {perObserver.map((scores, i) => (
            <ObserverCard key={i} index={i} scores={scores} />
          ))}
        </ul>
      </section>
    </div>
  );
}

interface ComparisonRow {
  slug: string;
  name: string;
  self: number;
  others: number;
  /** self − others: positive = you rate it higher, negative = others do. */
  gap: number;
}

function CompareBar({
  label,
  value,
  sharedMax,
  accent,
  variant,
}: {
  label: string;
  value: number;
  sharedMax: number;
  accent: string;
  variant: "self" | "others";
}) {
  const fraction = sharedMax > 0 ? value / sharedMax : 0;
  // Keep a nonzero selection faintly visible even when it is tiny.
  const width = `${Math.max(fraction * 100, value > 0 ? 3 : 0)}%`;
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
          width,
          backgroundColor: accent,
          opacity: variant === "self" ? 1 : 0.4,
        }}
      />
    </div>
  );
}

/**
 * The alignment / divergence callout: the sharpest place others see something
 * the Subject does not, the sharpest place the Subject claims something others
 * do not, and the tribe where the two reads agree most strongly.
 */
function AlignmentDivergence({ rows }: { rows: ComparisonRow[] }) {
  // Only tribes either side actually registered are worth talking about.
  const meaningful = rows.filter((r) => Math.max(r.self, r.others) > 0);

  const seenMoreByOthers = [...meaningful].sort((a, b) => a.gap - b.gap)[0];
  const claimedMoreBySelf = [...meaningful].sort((a, b) => b.gap - a.gap)[0];
  const strongestAgreement = [...meaningful].sort(
    (a, b) => Math.abs(a.gap) - Math.abs(b.gap),
  )[0];

  const EPSILON = 1e-9;
  const insights: { key: string; label: string; body: React.ReactNode }[] = [];

  if (strongestAgreement) {
    insights.push({
      key: "agree",
      label: "Strong agreement",
      body: (
        <>
          You and your observers land closest on{" "}
          <TribeName slug={strongestAgreement.slug} /> — a shared read you can
          trust.
        </>
      ),
    });
  }
  if (seenMoreByOthers && seenMoreByOthers.gap < -EPSILON) {
    insights.push({
      key: "others",
      label: "Others see it more",
      body: (
        <>
          Observers read <TribeName slug={seenMoreByOthers.slug} /> in you more
          than you claimed it — a possible blind strength.
        </>
      ),
    });
  }
  if (claimedMoreBySelf && claimedMoreBySelf.gap > EPSILON) {
    insights.push({
      key: "self",
      label: "You see it more",
      body: (
        <>
          You lean on <TribeName slug={claimedMoreBySelf.slug} /> more than your
          observers saw — worth asking how it lands.
        </>
      ),
    });
  }

  if (insights.length === 0) return null;

  return (
    <section className="mt-14 border-t border-hair pt-8">
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Where you align &amp; diverge
      </p>
      <ul className="mt-6 flex flex-col gap-4">
        {insights.map((insight) => (
          <li
            key={insight.key}
            className="rounded-[2px] border border-hair p-5"
          >
            <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
              {insight.label}
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-ink">
              {insight.body}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One anonymous observer's read: their top tribe (and secondary when clear). */
function ObserverCard({
  index,
  scores,
}: {
  index: number;
  scores: TribeScore[];
}) {
  const { primary, secondary } = deriveResult(scores);
  const tribe = getTribeBySlug(primary.slug);
  const accent = accentHex(tribe?.color ?? "");

  return (
    <li className="rounded-[2px] border border-hair p-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
        Observer {index + 1}
      </div>
      <div className="mt-2 font-serif text-[22px] font-semibold leading-tight">
        <span style={{ color: accent }}>{primary.name}</span>
      </div>
      {tribe && (
        <div className="mt-0.5 font-serif text-[15px] italic text-muted">
          {tribe.callSign}
        </div>
      )}
      {secondary && (
        <div className="mt-2 text-[13px] text-muted">
          with a touch of{" "}
          <span className="text-ink">{secondary.name}</span>
        </div>
      )}
    </li>
  );
}

/** A tribe's name in its accent color, for inline prose. */
function TribeName({ slug }: { slug: string }) {
  const tribe = getTribeBySlug(slug);
  if (!tribe) return <span>{slug}</span>;
  return (
    <span className="font-medium" style={{ color: accentHex(tribe.color) }}>
      {tribe.name}
    </span>
  );
}
