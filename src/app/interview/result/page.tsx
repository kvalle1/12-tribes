import Link from "next/link";
import { redirect } from "next/navigation";
import { stubResult } from "@/lib/interview/flow";
import { toPercentages } from "@/lib/interview/score";
import { currentSession } from "@/lib/interview/session";
import { accentHex, tribes } from "@/lib/tribes";
import { startInterview } from "../actions";

/**
 * Interview result page. Slice #16 wires real scoring in, so this now renders the
 * Strength Profile as ranked percentage bars (ADR-0002 display normalization)
 * instead of a bare placeholder. Primary/Contenders/Posture come in later slices.
 *
 * Reached only once the Session is complete — an in-progress or missing Session
 * routes back to the hub, so a refresh here still resolves to the right place.
 */
export default async function InterviewResultPage() {
  const session = await currentSession();

  if (!session || session.status !== "complete") {
    redirect("/interview");
  }

  const result = stubResult({
    status: session.status,
    turns: session.turns,
    profile: session.profile,
    trace: session.trace,
  });

  const percentages = toPercentages(session.profile);
  const ranked = tribes
    .map((tribe) => ({ tribe, pct: percentages[tribe.slug] ?? 0 }))
    .sort((a, b) => b.pct - a.pct);
  const top = ranked[0]?.pct ?? 0;
  const hasSignal = top > 0;

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
            {result.headline}
          </h1>
          <p className="mt-4 text-[16px] leading-[1.6] text-muted">
            {result.note}
          </p>
          <p className="mt-4 text-[14px] text-faint">
            You answered {session.turnCount}{" "}
            {session.turnCount === 1 ? "question" : "questions"}.
          </p>
        </div>

        <section className="mt-10">
          <h2 className="text-[11px] uppercase tracking-[0.16em] text-faint">
            Your early strength profile
          </h2>

          {hasSignal ? (
            <ul className="mt-5 flex flex-col gap-3">
              {ranked.map(({ tribe, pct }) => {
                const accent = accentHex(tribe.color);
                return (
                  <li key={tribe.slug}>
                    <div className="flex items-baseline justify-between gap-4 text-[14px]">
                      <span className="font-serif text-[16px]">{tribe.name}</span>
                      <span className="tabular-nums text-muted">
                        {Math.round(pct)}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-[6px] w-full overflow-hidden rounded-full bg-hair">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: accent,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 text-[15px] leading-[1.6] text-muted">
              This answer didn&rsquo;t surface a clear tribe signal yet. The full
              interview asks more questions before it reads your wiring.
            </p>
          )}
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
