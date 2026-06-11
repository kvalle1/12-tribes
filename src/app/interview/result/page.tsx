import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionIdCookie } from "@/lib/interview/cookie";
import { getInterviewSession } from "@/lib/interview/repository";
import { isComplete } from "@/lib/interview/session";
import { restartInterview } from "../actions";

/**
 * Stub result page for the walking skeleton (#14). Real scoring — Strength
 * Profile, Posture, Primary/Contenders — arrives in later slices; for now this
 * just confirms the end-to-end path completed and the answers were saved.
 */
export default async function InterviewResultPage() {
  const id = await getSessionIdCookie();
  const state = id ? await getInterviewSession(id) : null;

  if (!state || !isComplete(state)) {
    redirect("/interview");
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
          The Interview · Result
        </div>

        <h1 className="mt-4 font-serif text-[40px] font-semibold leading-[1.05]">
          Interview complete
        </h1>
        <p className="mt-4 text-[16px] text-muted">
          Your result will appear here once scoring is in place. For now, this
          confirms your {state.turnCount === 1 ? "answer was" : "answers were"}{" "}
          saved.
        </p>

        <div className="mt-8 rounded-[2px] border border-hair p-5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
            Saved this session
          </div>
          <div className="mt-2 font-serif text-[18px]">
            {state.turnCount} {state.turnCount === 1 ? "answer" : "answers"}{" "}
            recorded
          </div>
        </div>

        <form action={restartInterview} className="mt-8">
          <button
            type="submit"
            className="rounded-[2px] border border-hair px-[28px] py-[12px] text-[13px] tracking-[0.08em] text-ink transition-colors hover:border-ink"
          >
            Start over
          </button>
        </form>
      </div>
    </main>
  );
}
