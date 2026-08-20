import Link from "next/link";
import { redirect } from "next/navigation";
import { stubResult } from "@/lib/interview/flow";
import { normalizeProfile } from "@/lib/interview/scoring";
import { currentSession } from "@/lib/interview/session";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { startInterview } from "../actions";

/**
 * Interview result page.
 *
 * Slice 3 delivers a single real-scored Turn (issue #16): the interpreter
 * cited Markers, the pure scoring engine folded them into the Strength
 * Profile, and this page renders the normalized display shares (ADR 0002) so
 * the participant can see the real numbers behind their Turn. The full result
 * view (Primary + Contenders, Posture, score trace) lands in later slices;
 * this page's job is to confirm the LLM → Marker → delta path made it all the
 * way through.
 *
 * Reached only once the Session is complete — an in-progress or missing
 * Session routes back to the hub, so a refresh here still resolves correctly.
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
    posture: session.posture ?? {},
    currentQuestion: session.currentQuestion ?? null,
  });

  const normalized = normalizeProfile(session.profile);
  const ranked = [...normalized.entries].sort((a, b) => b.share - a.share);
  const top = ranked[0];
  const anyEvidence = normalized.entries.some((e) => e.score > 0);

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

        {/*
          The real-scored slice-3 view: normalized shares across all 12 tribes.
          A single Turn produces sparse evidence, so many rows will be zero —
          that's expected, and honest to show.
        */}
        <section className="mt-14">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            {anyEvidence ? "How the twelve scored" : "No signal yet"}
          </p>
          {!anyEvidence && (
            <p className="mt-3 text-[14px] text-muted">
              The interpreter didn&rsquo;t find catalogued Markers in your
              answer. That happens with very short or off-topic responses — try
              again with a fuller answer.
            </p>
          )}
          <ul className="mt-6 flex flex-col gap-3.5">
            {ranked.map((row) => {
              const tribe = getTribeBySlug(row.slug);
              const accent = accentHex(tribe?.color ?? "");
              const isTop = anyEvidence && row.slug === top.slug;
              return (
                <li
                  key={row.slug}
                  className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
                >
                  <div className="flex items-baseline gap-2">
                    <span
                      className="font-serif text-[17px] leading-none"
                      style={{ color: isTop ? accent : undefined }}
                    >
                      {tribe?.name ?? row.slug}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
                      role="img"
                      aria-label={`${tribe?.name ?? row.slug}: ${Math.round(row.share * 100)}% of scored evidence`}
                    >
                      <div
                        className="h-full rounded-full transition-[width]"
                        style={{
                          width: `${Math.max(row.share * 100, row.score > 0 ? 3 : 0)}%`,
                          backgroundColor: accent,
                          opacity: isTop ? 1 : 0.55,
                        }}
                      />
                    </div>
                    <span className="w-[48px] shrink-0 text-right text-[12px] tabular-nums text-faint">
                      {Math.round(row.share * 100)}%
                    </span>
                  </div>
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
        <form action={startInterview} className="mt-14">
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
