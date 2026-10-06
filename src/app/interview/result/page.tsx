import Link from "next/link";
import { redirect } from "next/navigation";
import { deriveInterviewResult } from "@/lib/interview/flow";
import { currentSession } from "@/lib/interview/session";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import type { InterviewResult, InterviewTurn, TraceEntry } from "@/lib/interview/types";
import { startInterview } from "../actions";

/**
 * Interview result: the ranked 12-tribe Strength Profile the Interview produced,
 * plus a compact score trace showing which answer mapped to which Marker (ADR-0003).
 * The full transparency view (per-marker drill-down, progress UX) is slice #21;
 * this slice proves the loop scored real answers and the trace is inspectable.
 *
 * Reached only once the Session is complete — an in-progress or missing Session
 * routes back to the hub, so a refresh here still resolves to the right place.
 */
export default async function InterviewResultPage() {
  const session = await currentSession();

  if (!session || session.status !== "complete") {
    redirect("/interview");
  }

  // Prefer the persisted result; recompute from the profile as a safety net.
  const result: InterviewResult =
    session.result ??
    deriveInterviewResult({
      status: session.status,
      turns: session.turns,
      profile: session.profile,
      trace: session.trace,
      currentQuestion: session.currentQuestion,
    });

  const topShare = result.ranking[0]?.share ?? 0;
  const primarySlug = result.ranking[0]?.slug;

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[620px] px-8 py-[120px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <div className="mt-10 text-[11px] uppercase tracking-[0.16em] text-faint">
          Interview complete
        </div>
        <h1 className="mt-3 font-serif text-[34px] font-semibold leading-[1.1]">
          Your Strength Profile
        </h1>
        <p className="mt-4 text-[16px] leading-[1.6] text-muted">
          Inferred from how you answered — every score traces to a catalogued
          Marker, shown below. You answered {session.turnCount}{" "}
          {session.turnCount === 1 ? "question" : "questions"}.
        </p>

        {/* Ranked bars — all twelve tribes, so the participant sees why they got this. */}
        <section className="mt-12 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            How the twelve scored
          </p>
          <ul className="mt-6 flex flex-col gap-3.5">
            {result.ranking.map((row) => {
              const tribe = getTribeBySlug(row.slug);
              const accent = accentHex(tribe?.color ?? "");
              const isPrimary = row.slug === primarySlug && row.score > 0;
              const width =
                topShare > 0 ? Math.max((row.share / topShare) * 100, row.score > 0 ? 3 : 0) : 0;
              return (
                <li
                  key={row.slug}
                  className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
                >
                  <span
                    className="font-serif text-[17px] leading-none"
                    style={{ color: isPrimary ? accent : undefined }}
                  >
                    {row.name}
                  </span>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
                      role="img"
                      aria-label={`${row.name}: ${Math.round(row.share)}%`}
                    >
                      <div
                        className="h-full rounded-full transition-[width]"
                        style={{ width: `${width}%`, backgroundColor: accent, opacity: isPrimary ? 1 : 0.55 }}
                      />
                    </div>
                    <span className="w-[44px] shrink-0 text-right text-[12px] tabular-nums text-faint">
                      {Math.round(row.share)}%
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Score trace — which answer mapped to which Marker (ADR-0003). */}
        <ScoreTrace turns={session.turns} trace={session.trace} />

        {/*
          A completed Session dead-ends here (/interview redirects a complete
          Session straight back), so this starts a fresh Session to go again.
        */}
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

/** Per-Turn breakdown of which Markers each answer fired. */
function ScoreTrace({ turns, trace }: { turns: InterviewTurn[]; trace: TraceEntry[] }) {
  if (trace.length === 0) return null;
  return (
    <section className="mt-14 border-t border-hair pt-8">
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Why you scored this
      </p>
      <ol className="mt-6 flex flex-col gap-6">
        {turns.map((turn, i) => {
          const entries = trace.filter((t) => t.turnIndex === i);
          if (entries.length === 0) return null;
          return (
            <li key={i}>
              <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
                Answer {i + 1}
              </p>
              <p className="mt-2 text-[15px] italic leading-[1.55] text-muted">
                &ldquo;{turn.answer}&rdquo;
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {entries.map((entry, j) => {
                  const tribe = getTribeBySlug(entry.tribeSlug);
                  const accent = accentHex(tribe?.color ?? "");
                  return (
                    <li
                      key={`${entry.markerId}-${j}`}
                      className="rounded-[2px] border px-3 py-1 text-[13px]"
                      style={{ borderColor: `${accent}66`, color: "var(--ink)" }}
                    >
                      <span style={{ color: accent }}>{tribe?.name ?? entry.tribeSlug}</span>
                      <span className="text-faint"> · {entry.type}</span>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
