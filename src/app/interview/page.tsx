import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { loadSession } from "@/lib/interview/session-repository";
import { TOTAL_TURNS, isComplete, nextTurn } from "@/lib/interview/skeleton";
import { startInterview, submitAnswer } from "./actions";

/**
 * The Interview walking skeleton (issue #14). A Server Component that reads the
 * active Session from Postgres on every render, so a refresh or reopened tab
 * resumes at the exact Turn the participant left off on (ADR-0011). No scoring
 * state is ever sent to the client — only the rendered question text.
 */
export default async function InterviewPage() {
  const cookieStore = await cookies();
  const id = cookieStore.get("interview_session")?.value;
  const state = id ? await loadSession(id) : null;

  // No active Session (or a stale cookie) — show the entry screen.
  if (!state) {
    return (
      <InterviewShell>
        <h1 className="mt-10 font-serif text-[40px] font-semibold leading-[1.05]">
          The Interview
        </h1>
        <p className="mt-3 text-[16px] text-muted">
          A short conversation that reads how you&rsquo;re wired from how you
          talk about yourself — not from words off a list. Answer in your own
          words; you can close the tab and come back without losing your place.
        </p>
        <form action={startInterview} className="mt-8">
          <button
            type="submit"
            className="rounded-[2px] bg-ink px-[34px] py-[14px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
          >
            Begin the Interview
          </button>
        </form>
      </InterviewShell>
    );
  }

  // Finished — the result lives on its own page.
  if (isComplete(state)) {
    redirect("/interview/result");
  }

  const turn = nextTurn(state);
  // `state` is in progress, so `nextTurn` is always a question here; this
  // narrows the type for the renderer below.
  if (turn.kind !== "question") {
    redirect("/interview/result");
  }

  return (
    <InterviewShell>
      <div className="mt-10 text-[11px] uppercase tracking-[0.16em] text-faint">
        Question {turn.index + 1} of {TOTAL_TURNS}
      </div>
      <h1 className="mt-3 font-serif text-[30px] font-semibold leading-[1.15]">
        {turn.prompt}
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
          placeholder="Take your time — answer however feels true."
          className="resize-y rounded-[2px] border border-hair bg-white px-4 py-3 text-[16px] leading-[1.5] outline-none focus:border-gold"
        />
        <button
          type="submit"
          className="self-start rounded-[2px] bg-ink px-[34px] py-[14px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
        >
          Continue
        </button>
      </form>
    </InterviewShell>
  );
}

function InterviewShell({ children }: { children: React.ReactNode }) {
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
