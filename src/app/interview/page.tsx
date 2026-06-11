import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getInterviewState } from "@/db/interview";
import { currentTurn } from "@/lib/interview/session";
import { beginInterview, submitAnswer } from "./actions";

/**
 * The Interview. Server-authoritative (ADR-0009): the page reads the Session
 * from Postgres via an httpOnly cookie and renders whichever Turn is live, so a
 * refresh or reopened tab resumes at the right point (ADR-0011). Slice 1 is a
 * walking skeleton — placeholder questions, no scoring.
 */
export default async function InterviewPage() {
  const jar = await cookies();
  const id = jar.get("interview_session")?.value;
  const state = id ? await getInterviewState(id) : null;

  // No active Session — offer to begin one.
  if (!state) {
    return (
      <Shell>
        <h1 className="mt-10 font-serif text-[40px] font-semibold leading-[1.05]">
          The Interview
        </h1>
        <p className="mt-3 text-[16px] text-muted">
          A short conversation that listens to how you describe yourself and
          reflects back which tribes you’re wired toward. Answer in your own
          words — there are no right answers.
        </p>
        <form action={beginInterview} className="mt-8">
          <button
            type="submit"
            className="rounded-[2px] bg-ink px-[34px] py-[14px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
          >
            Begin the Interview
          </button>
        </form>
      </Shell>
    );
  }

  // Finished — the result lives on its own page.
  if (state.status === "complete") {
    redirect("/interview/result");
  }

  const turn = currentTurn(state)!;

  return (
    <Shell>
      <div className="mt-10 text-[11px] uppercase tracking-[0.16em] text-faint">
        Question {turn.index + 1}
      </div>
      <h1 className="mt-3 font-serif text-[28px] font-semibold leading-[1.2]">
        {turn.question}
      </h1>

      <form action={submitAnswer} className="mt-8 flex flex-col gap-3">
        <label htmlFor="answer" className="sr-only">
          Your answer
        </label>
        <textarea
          id="answer"
          name="answer"
          required
          rows={5}
          autoFocus
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
