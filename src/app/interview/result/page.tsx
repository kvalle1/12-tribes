import Link from "next/link";
import { redirect } from "next/navigation";
import { summarize } from "@/lib/interview/confidence";
import { accumulatePosture, posturePosition } from "@/lib/interview/scoring";
import { currentSession } from "@/lib/interview/session";
import type { PostureArc } from "@/lib/interview/types";
import { accentHex, getTribeBySlug, statusLabels, type Tribe } from "@/lib/tribes";
import { startInterview } from "../actions";

/** Short label for a tribe's position on its fall→oil arc (ADR-0004). */
const POSTURE_LABEL: Record<PostureArc, string> = {
  "active-shadow": "Active shadow",
  mixed: "On the arc",
  integrated: "Integrated",
};

/** One plain-language line describing what the arc position means. */
const POSTURE_BLURB: Record<PostureArc, string> = {
  "active-shadow": "living closer to this tribe’s fall-line than its oil",
  mixed: "held between this tribe’s fall-line and its oil",
  integrated: "maturing into this tribe’s oil, past its fall-line",
};

/**
 * Non-condemning, arc-aware framing for a Primary whose tribe carries a
 * disqualified/warning status (ADR-0007: scoring is status-blind, so a
 * disqualified tribe can be your honest result — the status only shapes how the
 * result is *read*). Active-shadow gets a cautionary reading, integrated a
 * redemption reading, and the copy always points at the tribe's oil, never a
 * sentence.
 */
function statusFraming(
  tribe: Tribe,
  arc: PostureArc | null,
): { heading: string; body: string } {
  const label = statusLabels[tribe.status];
  const reading =
    arc === "integrated"
      ? `You’re reading as integrated here — living toward ${tribe.name}’s oil rather than its fall-line. That maturity is the redemption this arc points to, not a disqualification you’re stuck in.`
      : arc === "active-shadow"
        ? `You’re reading near ${tribe.name}’s active shadow. That isn’t a verdict — it’s the cautionary edge of this wiring, and the exact place the arc invites you to move from.`
        : `Where you sit on ${tribe.name}’s arc is still open. The direction that redeems this pattern is its oil.`;
  return {
    heading: `${label}: read the arc, not a verdict`,
    body: `${reading} ${tribe.name}’s oil — ${tribe.oil} Restoration, not rejection, is the point of naming it.`,
  };
}

/**
 * Interview result (slice 4, issue #17): the Primary — or honest Co-Primaries
 * when the top tribes never separated (ADR-0006) — plus the dynamic Contender
 * band, each with its display percentage (ADR-0002), and the full twelve below.
 *
 * Slice 6 (issue #20) adds the Posture axis: each contender shows where it sits
 * on its fall→oil arc, derived from the persisted score trace (ADR-0004), and a
 * Primary on a disqualified/warning tribe gets non-condemning, arc-aware framing
 * (ADR-0007). The score trace's own detail view arrives in a later slice.
 *
 * Reached only once the Session is complete — an in-progress or missing Session
 * routes back to the hub, so a refresh here still resolves to the right place.
 * This is a server component: it reads the authoritative Session and the
 * `server-only` scoring engine, so no scoring state reaches the client.
 */
export default async function InterviewResultPage() {
  const session = await currentSession();

  if (!session || session.status !== "complete") {
    redirect("/interview");
  }

  // Sessions completed before slice 4 hold a legacy stub result; derive the
  // reading from their profile instead.
  const result = Array.isArray(session.result?.primary)
    ? session.result
    : summarize(session.profile);
  const pct = result.percentages;
  const primaryNames = result.primary.map((slug) => getTribeBySlug(slug)?.name ?? slug);
  const otherContenders = result.contenders.filter((slug) => !result.primary.includes(slug));
  const ranked = Object.entries(pct)
    .map(([slug, value]) => ({ slug, value }))
    .sort((a, b) => b.value - a.value);
  const top = ranked[0]?.value ?? 0;

  // Posture (ADR-0004): where each tribe sits on its fall→oil arc, derived from
  // the persisted score trace (same pattern as the confidence replay). A tribe
  // with no posture-bearing evidence simply has no reading.
  const posture = accumulatePosture(session.trace);
  const arcFor = (slug: string): PostureArc | null =>
    posturePosition(posture[slug] ?? { activeShadow: 0, integrated: 0 })?.arc ?? null;

  // Primaries whose tribe carries a non-active status get arc-aware, non-
  // condemning framing (ADR-0007).
  const flaggedPrimaries = result.primary
    .map((slug) => getTribeBySlug(slug))
    .filter((t): t is Tribe => !!t && t.status !== "active");

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[620px] px-8 py-[120px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <div className="mt-10 rounded-[2px] border border-gold/40 bg-gold/5 p-8">
          <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
            Interview complete
          </div>
          <h1 className="mt-3 font-serif text-[34px] font-semibold leading-[1.1]">
            {primaryNames.length === 0
              ? "No clear tribe emerged"
              : result.coPrimary
                ? `Co-Primary: ${primaryNames.join(" & ")}`
                : `Primary: ${primaryNames[0]}`}
          </h1>
          <p className="mt-4 text-[16px] leading-[1.6] text-muted">
            Scored from your {session.turnCount}{" "}
            {session.turnCount === 1 ? "answer" : "answers"} against the Marker
            Catalog.{" "}
            {result.coPrimary
              ? "Your top tribes stayed inseparable to the end, so the Interview reports them together rather than forcing a single winner."
              : "Each share reflects how strongly your words resonated with a tribe’s signals."}
          </p>
        </div>

        {flaggedPrimaries.map((tribe) => {
          const framing = statusFraming(tribe, arcFor(tribe.slug));
          return (
            <section
              key={tribe.slug}
              className="mt-8 rounded-[2px] border border-hair bg-ink/[0.02] p-6"
            >
              <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
                {framing.heading}
              </p>
              <p className="mt-3 text-[15px] leading-[1.65] text-muted">
                {framing.body}
              </p>
            </section>
          );
        })}

        {result.contenders.length > 0 && (
          <section className="mt-12">
            <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
              {otherContenders.length > 0 ? "Primary & contenders" : "Primary"}
            </p>
            <ul className="mt-6 flex flex-col gap-4">
              {result.contenders.map((slug) => {
                const tribe = getTribeBySlug(slug);
                const isPrimary = result.primary.includes(slug);
                const arc = arcFor(slug);
                return (
                  <li
                    key={slug}
                    className="flex items-baseline justify-between gap-4 border-b border-hair pb-3"
                  >
                    <span>
                      <Link
                        href={`/tribes/${slug}`}
                        className="font-serif text-[22px] transition-colors hover:text-gold"
                      >
                        {tribe?.name ?? slug}
                        <span className="ml-3 text-[11px] uppercase tracking-[0.16em] text-faint">
                          {isPrimary ? (result.coPrimary ? "Co-Primary" : "Primary") : "Contender"}
                        </span>
                      </Link>
                      {arc && (
                        <span className="mt-1 block text-[12px] leading-[1.4] text-faint">
                          <span className="uppercase tracking-[0.1em]">{POSTURE_LABEL[arc]}</span>
                          {" · "}
                          {POSTURE_BLURB[arc]}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-[15px] tabular-nums text-muted">
                      {Math.round(pct[slug] ?? 0)}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="mt-12 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            How the twelve scored
          </p>
          <ul className="mt-6 flex flex-col gap-3.5">
            {ranked.map((row) => {
              const tribe = getTribeBySlug(row.slug);
              const accent = accentHex(tribe?.color ?? "");
              const width = top > 0 ? (row.value / top) * 100 : 0;
              return (
                <li key={row.slug} className="flex items-center gap-4">
                  <span className="w-[108px] shrink-0 font-serif text-[16px]">
                    {tribe?.name ?? row.slug}
                  </span>
                  <span className="relative h-[8px] flex-1 overflow-hidden rounded-full bg-hair/60">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${width}%`, backgroundColor: accent }}
                    />
                  </span>
                  <span className="w-[44px] shrink-0 text-right text-[13px] tabular-nums text-muted">
                    {Math.round(row.value)}%
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/*
          A completed Session otherwise dead-ends here: /interview redirects a
          complete Session straight back to this page, so the start screen is
          unreachable. This starts a fresh Session (overwriting the cookie) so
          the participant can go again.
        */}
        <form action={startInterview} className="mt-10">
          <button
            type="submit"
            className="rounded-[2px] bg-ink px-[34px] py-[14px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
          >
            Start a new interview
          </button>
        </form>
      </div>
    </main>
  );
}
