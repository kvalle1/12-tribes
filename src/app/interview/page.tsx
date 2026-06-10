import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { interviewSessions } from "@/db/schema";
import {
  INTERVIEW_QUESTIONS,
  INTERVIEW_SESSION_COOKIE,
  currentQuestion,
} from "@/lib/interview/session";
import { startInterview, submitAnswer } from "./actions";

/**
 * The Interview flow's single entry/continuation point. Reading the session
 * cookie makes this route dynamic, so on every visit (including a refresh) it
 * loads the live Session from Postgres and renders the right step — start
 * screen, the current question, or a redirect to the result. No scoring state
 * crosses to the client (ADR-0009).
 */
export default async function InterviewPage() {
  const jar = await cookies();
  const id = jar.get(INTERVIEW_SESSION_COOKIE)?.value;

  const row = id
    ? (
        await db
          .select()
          .from(interviewSessions)
          .where(eq(interviewSessions.id, id))
      )[0]
    : undefined;

  // No active session → the start screen.
  if (!row) {
    return (
      <Shell>
        <h1 className="mt-10 font-serif text-[40px] font-semibold leading-[1.05]">
          The Interview
        </h1>
        <p className="mt-3 text-[16px] text-muted">
          An adaptive conversation that reads how you&rsquo;re wired from how you
          talk about yourself — not from words you pick off a list. This is an
          early walking skeleton: one question, your answer, saved as you go.
        </p>
        <form action={startInterview} className="mt-8">
          <button
            type="submit"
            className="rounded-[2px] bg-ink px-[34px] py-[14px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
          >
            Begin the interview
          </button>
        </form>
      </Shell>
    );
  }

  if (row.status === "complete") {
    redirect("/interview/result");
  }

  const question = currentQuestion({
    turns: row.turns,
    turnCount: row.turnCount,
    status: row.status,
  });
  // In progress but out of questions shouldn't happen; treat as complete.
  if (question === null) {
    redirect("/interview/result");
  }

  const step = row.turnCount + 1;
  const total = INTERVIEW_QUESTIONS.length;

  return (
    <Shell>
      <div className="mt-10 text-[11px] uppercase tracking-[0.16em] text-faint">
        Question {step} of {total}
      </div>
      <h1 className="mt-3 font-serif text-[28px] font-semibold leading-[1.2]">
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
          autoFocus
          placeholder="Answer in your own words…"
          className="resize-y rounded-[2px] border border-hair bg-white px-4 py-3 text-[16px] leading-[1.5] outline-none focus:border-gold"
        />
        <button
          type="submit"
          className="self-start rounded-[2px] bg-ink px-[34px] py-[14px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
        >
          Continue
        </button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[560px] px-8 py-[120px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>
        {children}
      </div>
    </main>
  );
}
