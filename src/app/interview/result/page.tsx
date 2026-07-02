import Link from "next/link";
import { redirect } from "next/navigation";
import { interviewResult } from "@/lib/interview/flow";
import { currentSession } from "@/lib/interview/session";
import { startInterview } from "../actions";

/**
 * Interview result page. Shows a provisional read — the leading tribe by
 * normalized strength from the scored profile (issue #16). The full Primary +
 * Contenders result, Posture, and the score-trace view arrive in later slices.
 *
 * Reached only once the Session is complete — an in-progress or missing Session
 * routes back to the hub, so a refresh here still resolves to the right place.
 */
export default async function InterviewResultPage() {
  const session = await currentSession();

  if (!session || session.status !== "complete") {
    redirect("/interview");
  }

  const result = interviewResult({
    status: session.status,
    turns: session.turns,
    profile: session.profile,
    trace: session.trace,
    pendingQuestion: session.pendingQuestion,
  });

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
          A completed Session otherwise dead-ends here: /interview redirects a
          complete Session straight back to this page, so the start screen is
          unreachable. This starts a fresh Session (overwriting the cookie) so
          the participant can go again.
        */}
        <form action={startInterview} className="mt-8">
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
