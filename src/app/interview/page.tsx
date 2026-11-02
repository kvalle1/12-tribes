import Link from "next/link";
import { redirect } from "next/navigation";
import { nextTurn } from "@/lib/interview/flow";
import { interviewProgress } from "@/lib/interview/progress";
import { toState } from "@/lib/interview/repository";
import { currentSession } from "@/lib/interview/session";
import { startInterview, submitAnswer } from "./actions";

/**
 * Interview hub. The view is derived purely from the server-side Session, so a
 * reload or reopened tab resumes at the right point (ADR-0011):
 *
 *   no session     → the start screen
 *   in progress    → the current question, or a Dilemma (two situations + why)
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

  const turn = session ? nextTurn(toState(session)) : null;
  // A rough sense of position for an open-ended Interview — never "N of a
  // fixed total" (issue #21 / ADR-0006). Derived on the server from the
  // authoritative profile so the raw scoring state stays off the client.
  const progress =
    session && turn && turn.kind !== "result"
      ? interviewProgress(session.profile, session.turnCount)
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

        {!session || !turn || turn.kind === "result" ? (
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
            <div className="mt-8">
              <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-faint">
                <span>Question {turn.questionNumber}</span>
                {progress && <span>{progress.label}</span>}
              </div>
              {progress && (
                <div
                  className="mt-3 h-[4px] w-full overflow-hidden rounded-full bg-hair/60"
                  role="progressbar"
                  aria-label="Interview progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress.fraction * 100)}
                >
                  <div
                    className="h-full rounded-full bg-gold transition-all duration-500"
                    style={{ width: `${Math.round(progress.fraction * 100)}%` }}
                  />
                </div>
              )}
            </div>
            <p className="mt-6 font-serif text-[22px] leading-[1.4]">
              {turn.prompt}
            </p>

            <form
              key={turn.questionNumber}
              action={submitAnswer}
              className="mt-8 flex flex-col gap-3"
            >
              <input type="hidden" name="turnCount" value={turn.questionNumber - 1} />
              {turn.kind === "dilemma" && (
                <fieldset className="mb-3 flex flex-col gap-3">
                  <legend className="sr-only">Choose one situation</legend>
                  {(
                    [
                      ["A", turn.dilemma.situationA],
                      ["B", turn.dilemma.situationB],
                    ] as const
                  ).map(([value, situation]) => (
                    <label
                      key={value}
                      className="flex cursor-pointer gap-3 rounded-[2px] border border-hair bg-white px-4 py-3 text-[16px] leading-[1.6] has-[:checked]:border-gold"
                    >
                      <input
                        type="radio"
                        name="choice"
                        value={value}
                        required
                        className="mt-[6px] accent-gold"
                      />
                      <span>{situation}</span>
                    </label>
                  ))}
                </fieldset>
              )}
              <label htmlFor="answer" className="sr-only">
                {turn.kind === "dilemma" ? "Why that one?" : "Your answer"}
              </label>
              <textarea
                id="answer"
                name="answer"
                required
                rows={turn.kind === "dilemma" ? 4 : 6}
                autoFocus={turn.kind === "question"}
                placeholder={
                  turn.kind === "dilemma"
                    ? "Why that one? What would you be giving up?"
                    : "Take your time — a few sentences is plenty."
                }
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
