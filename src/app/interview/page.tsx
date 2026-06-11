import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionIdCookie } from "@/lib/interview/cookie";
import { getInterviewSession } from "@/lib/interview/repository";
import {
  TOTAL_QUESTIONS,
  currentQuestion,
  isComplete,
} from "@/lib/interview/session";
import { startInterview, submitAnswer } from "./actions";

/**
 * The Interview walking skeleton (#14). Reads the resume cookie on the server,
 * loads the Session, and renders either the start screen or the current Turn.
 * Reading `cookies()` makes this route dynamic, so it never renders at build.
 */
export default async function InterviewPage() {
  const id = await getSessionIdCookie();
  const state = id ? await getInterviewSession(id) : null;

  if (state && isComplete(state)) {
    redirect("/interview/result");
  }

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
          The Interview
        </div>

        {state === null ? (
          <StartScreen />
        ) : (
          <QuestionScreen
            question={currentQuestion(state) ?? ""}
            answered={state.turnCount}
          />
        )}
      </div>
    </main>
  );
}

function StartScreen() {
  return (
    <>
      <h1 className="mt-4 font-serif text-[40px] font-semibold leading-[1.05]">
        A conversation, not a checklist
      </h1>
      <p className="mt-4 text-[16px] text-muted">
        The Interview asks open questions and listens to how you answer in your
        own words. Take your time — you can close the tab and pick up where you
        left off.
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
  );
}

function QuestionScreen({
  question,
  answered,
}: {
  question: string;
  answered: number;
}) {
  return (
    <>
      <div className="mt-4 text-[12px] uppercase tracking-[0.16em] text-muted">
        Question {answered + 1} of {TOTAL_QUESTIONS}
      </div>

      <h1 className="mt-4 font-serif text-[28px] font-medium leading-[1.25]">
        {question}
      </h1>

      <form action={submitAnswer} className="mt-8 flex flex-col gap-3">
        <label htmlFor="answer" className="sr-only">
          Your answer
        </label>
        <textarea
          id="answer"
          name="answer"
          required
          rows={6}
          placeholder="Answer in your own words…"
          className="rounded-[2px] border border-hair bg-white px-4 py-3 text-[16px] leading-[1.5] outline-none focus:border-gold"
        />
        <button
          type="submit"
          className="self-start rounded-[2px] bg-ink px-[34px] py-[14px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
        >
          Continue
        </button>
      </form>
    </>
  );
}
