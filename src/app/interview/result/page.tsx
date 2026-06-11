import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getInterviewState } from "@/db/interview";
import { beginInterview } from "../actions";

/**
 * Stub Interview result (issue #14). The walking skeleton proves the end-to-end
 * path through UI → server → persistence; the real Strength Profile, Posture, and
 * score trace arrive in later slices. Redirects back into the flow if there is no
 * completed Session to show.
 */
export default async function InterviewResultPage() {
  const jar = await cookies();
  const id = jar.get("interview_session")?.value;
  const state = id ? await getInterviewState(id) : null;

  if (!state || state.status !== "complete") {
    redirect("/interview");
  }

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[560px] px-8 py-[120px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <h1 className="mt-10 font-serif text-[40px] font-semibold leading-[1.05]">
          Interview complete
        </h1>
        <p className="mt-3 text-[16px] text-muted">
          You answered {state.turnCount}{" "}
          {state.turnCount === 1 ? "question" : "questions"}. Your tribe reading
          will appear here — the scoring that turns these answers into a Strength
          Profile is still being built.
        </p>

        <div className="mt-8 rounded-[2px] border border-hair p-5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
            Coming soon
          </div>
          <div className="mt-2 font-serif text-[18px]">
            Your per-tribe Strength Profile and the answers behind it.
          </div>
        </div>

        <form action={beginInterview} className="mt-8">
          <button
            type="submit"
            className="rounded-[2px] border border-ink px-[28px] py-[12px] text-[13px] tracking-[0.08em] text-ink transition-colors hover:bg-ink hover:text-bone"
          >
            Start over
          </button>
        </form>
      </div>
    </main>
  );
}
