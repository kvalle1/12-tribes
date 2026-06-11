import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { loadSession } from "@/lib/interview/session-repository";
import { isComplete } from "@/lib/interview/skeleton";

/**
 * Stub result page for the walking skeleton (issue #14). It confirms the
 * end-to-end path completed; the real Strength Profile, Posture, and score
 * trace are filled in by later slices (#16, #17, #20, #21). A participant who
 * lands here without a completed Session is sent back to the Interview.
 */
export default async function InterviewResultPage() {
  const cookieStore = await cookies();
  const id = cookieStore.get("interview_session")?.value;
  const state = id ? await loadSession(id) : null;

  if (!state || !isComplete(state)) {
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

        <div className="mt-10 text-[11px] uppercase tracking-[0.16em] text-faint">
          Interview complete
        </div>
        <h1 className="mt-3 font-serif text-[40px] font-semibold leading-[1.05]">
          Thank you
        </h1>
        <p className="mt-3 text-[16px] text-muted">
          You answered {state.turnCount} of {state.turnCount}{" "}
          {state.turnCount === 1 ? "question" : "questions"}. Your tribe reading
          will appear here once scoring is in place.
        </p>

        <div className="mt-8 rounded-[2px] border border-hair p-5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
            Coming soon
          </div>
          <p className="mt-2 text-[15px] text-muted">
            A per-tribe Strength Profile, where you sit on each tribe&rsquo;s
            arc, and the reasoning behind every score.
          </p>
        </div>
      </div>
    </main>
  );
}
