import Link from "next/link";
import { redirect } from "next/navigation";
import { nextTurn } from "@/lib/interview/flow";
import { currentSession, startInterview, submitAnswer } from "./actions";

/**
 * Interview hub. The view is derived purely from the server-side Session, so a
 * reload or reopened tab resumes at the right point (ADR-0011):
 *
 *   no session     → the start screen
 *   in progress    → the current question
 *   complete       → the result page
 *
 * Reading the session cookie opts this route into dynamic rendering, so it's
 * always evaluated against the live Session rather than statically prerendered.
 */
export default async function InterviewPage() {
  const session = await currentSession();

  if (session && session.status === "complete") {
    redirect("/interview/result");
  }

  const turn = session
    ? nextTurn({
        status: session.status,
        turns: session.turns,
        profile: session.profile,
      })
    : null;

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[620px] px-8 py-[120px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <h1 className="mt-10 font-serif text-[40px] font-semibold leading-[1.05]">
          The Interview
        </h1>

        {!session || turn?.kind !== "question" ? (
          <>
            <p className="mt-3 text-[16px] text-muted">
              A guided conversation that reads how you&rsquo;re wired from your
              own words. Answer in full sentences — there are no right answers.
            </p>
            <form action={startInterview} className="mt-8">
              <button
                type="submit"
                className="rounded-[2px] bg-ink px-[34px] py-[14px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
              >
                Begin the Interview
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="mt-8 text-[11px] uppercase tracking-[0.16em] text-faint">
              Question {turn.questionNumber} of {turn.totalQuestions}
            </div>
            <p className="mt-4 font-serif text-[22px] leading-[1.4]">
              {turn.prompt}
            </p>

            <form action={submitAnswer} className="mt-8 flex flex-col gap-3">
              <label htmlFor="answer" className="sr-only">
                Your answer
              </label>
              <textarea
                id="answer"
                name="answer"
                required
                rows={6}
                autoFocus
                placeholder="Take your time — a few sentences is plenty."
                className="rounded-[2px] border border-hair bg-white px-4 py-3 text-[16px] leading-[1.6] outline-none focus:border-gold"
              />
              <button
                type="submit"
                className="self-start rounded-[2px] bg-ink px-[34px] py-[14px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
              >
                Submit answer
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
