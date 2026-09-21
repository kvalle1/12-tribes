import Link from "next/link";
import { redirect } from "next/navigation";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { currentSession } from "@/lib/interview/session";
import { startInterview } from "../actions";
import type { InterviewResult, TraceEntry } from "@/lib/interview/types";

/**
 * Interview result page (slice #16). Renders the derived Strength Profile as a
 * ranked bar chart across all 12 tribes, plus a per-answer score trace so the
 * result can explain itself (PRD story 11) — which answers cited which Markers.
 *
 * The dynamic Primary/Contender/Co-Primary headline and the Posture axis arrive
 * in slices #17 / #20; here the honest deliverable is the ranked profile and the
 * evidence behind it. The `result` (ranking) is computed and persisted on the
 * server; this page only reads and draws it.
 *
 * Reached only once the Session is complete — an in-progress or missing Session
 * routes back to the hub, so a refresh here still resolves to the right place.
 */
export default async function InterviewResultPage() {
  const session = await currentSession();

  if (!session || session.status !== "complete" || !session.result) {
    redirect("/interview");
  }

  const result = session.result as InterviewResult;
  const ranking = result.ranking;
  const top = ranking[0];

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[120px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <div className="mt-10 text-[11px] uppercase tracking-[0.16em] text-faint">
          Interview complete
        </div>
        <h1 className="mt-3 font-serif text-[40px] font-semibold leading-[1.05]">
          Your Strength Profile
        </h1>
        <p className="mt-3 text-[16px] leading-[1.6] text-muted">
          Scored from your own words against the tribe Markers. This ranks how
          strongly every tribe showed up{top ? <>, led by <strong className="text-ink">{top.name}</strong></> : null}.
        </p>

        {/* Ranked 12-tribe Strength Profile */}
        <ol className="mt-10 flex flex-col gap-3">
          {ranking.map((tribe, i) => {
            const accent = accentHex(getTribeBySlug(tribe.slug)?.color ?? "");
            return (
              <li key={tribe.slug}>
                <div className="flex items-baseline justify-between text-[14px]">
                  <span className={i === 0 ? "font-semibold text-ink" : "text-muted"}>
                    {i + 1}. {tribe.name}
                  </span>
                  <span className="tabular-nums text-faint">
                    {tribe.share.toFixed(0)}%
                  </span>
                </div>
                <div
                  className="mt-1 h-[8px] w-full overflow-hidden rounded-full bg-hair/60"
                  role="img"
                  aria-label={`${tribe.name}: ${Math.round(tribe.relative * 100)}% of the top score`}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(tribe.relative * 100, tribe.score > 0 ? 3 : 0)}%`,
                      backgroundColor: accent,
                      opacity: i === 0 ? 1 : 0.6,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ol>

        <ScoreTrace turns={session.turns} trace={session.trace} />

        <form action={startInterview} className="mt-12">
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

/**
 * The score trace, grouped by answer: for each Turn, which Markers fired and how
 * much each contributed. Makes the ranking inspectable rather than a bare
 * number. (How much raw answer text to surface is refined against the privacy
 * decision in slice #21 / issue #10; here the participant sees their own words.)
 */
function ScoreTrace({
  turns,
  trace,
}: {
  turns: { question: string; answer: string }[];
  trace: TraceEntry[];
}) {
  if (trace.length === 0) return null;

  return (
    <section className="mt-14">
      <h2 className="font-serif text-[24px] font-semibold">Why you scored this way</h2>
      <p className="mt-2 text-[14px] text-muted">
        Each answer, and the Markers it cited.
      </p>

      <div className="mt-6 flex flex-col gap-6">
        {turns.map((turn, turnIndex) => {
          const entries = trace.filter((e) => e.turnIndex === turnIndex);
          return (
            <div
              key={turnIndex}
              className="rounded-[2px] border border-hair bg-white/60 p-5"
            >
              <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
                Answer {turnIndex + 1}
              </div>
              <p className="mt-2 text-[15px] leading-[1.6] text-ink">{turn.answer}</p>

              {entries.length > 0 ? (
                <ul className="mt-4 flex flex-col gap-2 border-t border-hair pt-4">
                  {entries.map((entry, i) => (
                    <li
                      key={`${entry.markerId}-${i}`}
                      className="flex items-baseline justify-between gap-4 text-[13px]"
                    >
                      <span className="text-muted">
                        <span className="capitalize text-ink">{entry.tribeSlug}</span>
                        {" · "}
                        {entry.type}
                        {entry.postureSignal && entry.postureSignal !== "neutral"
                          ? ` · ${entry.postureSignal}`
                          : ""}
                      </span>
                      <span className="tabular-nums text-faint">
                        +{entry.contribution.toFixed(1)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 border-t border-hair pt-4 text-[13px] text-faint">
                  No Markers fired for this answer.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
