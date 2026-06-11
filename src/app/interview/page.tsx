import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loadSession } from "@/lib/interview/repository";
import { SESSION_COOKIE, currentTurn } from "@/lib/interview/session";
import { startInterview } from "@/lib/interview/actions";
import { AnswerForm } from "./answer-form";

/**
 * The Interview run page. Server-authoritative: it reads the session id from an
 * httpOnly cookie, loads the server-held state, and renders either the start
 * prompt, the current open Turn, or redirects to the result when complete.
 * Reloading or reopening the tab lands here and resumes at the right point.
 */
export default async function InterviewPage() {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  const session = id ? await loadSession(id) : null;

  if (!session) {
    return (
      <Shell>
        <p className="font-serif text-[22px] leading-[1.5] text-ink">
          A blind, adaptive conversation that reads how you&rsquo;re wired from
          how you talk — not from words you pick off a list.
        </p>
        <form action={startInterview} className="mt-10">
          <button
            type="submit"
            className="rounded-[2px] bg-ink px-7 py-3 text-[13px] uppercase tracking-[0.16em] text-bone transition-opacity hover:opacity-90"
          >
            Begin the Interview
          </button>
        </form>
      </Shell>
    );
  }

  if (session.status === "complete") {
    redirect("/interview/result");
  }

  const turn = currentTurn(session);
  if (!turn) {
    // In-progress but no open turn shouldn't happen in slice 1; recover safely.
    redirect("/interview/result");
  }

  return (
    <Shell>
      <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
        Question {turn.index + 1}
      </div>
      <p className="mt-3 font-serif text-[26px] leading-[1.4] text-ink">
        {turn.prompt}
      </p>
      <AnswerForm />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[640px] px-8 py-[120px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>
        <h1 className="mt-10 font-serif text-[40px] font-semibold leading-[1.05]">
          The Interview
        </h1>
        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}
