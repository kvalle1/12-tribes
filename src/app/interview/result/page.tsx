import Link from "next/link";
import { redirect } from "next/navigation";
import { stubResult } from "@/lib/interview/flow";
import { currentSession } from "../actions";

/**
 * Stub result page for the walking-skeleton slice. Real scoring (Strength
 * Profile, Primary + Contenders, Posture, score trace) replaces this in later
 * slices; here it confirms the end-to-end path completed and persisted.
 *
 * Reached only once the Session is complete — an in-progress or missing Session
 * routes back to the hub, so a refresh here still resolves to the right place.
 */
export default async function InterviewResultPage() {
  const session = await currentSession();

  if (!session || session.status !== "complete") {
    redirect("/interview");
  }

  const result = stubResult({
    status: session.status,
    turns: session.turns,
    profile: session.profile,
  });

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[620px] px-8 py-[120px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <div className="mt-10 rounded-[2px] border border-gold/40 bg-gold/5 p-8">
          <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
            Interview complete
          </div>
          <h1 className="mt-3 font-serif text-[34px] font-semibold leading-[1.1]">
            {result.headline}
          </h1>
          <p className="mt-4 text-[16px] leading-[1.6] text-muted">
            {result.note}
          </p>
          <p className="mt-4 text-[14px] text-faint">
            You answered {session.turnCount}{" "}
            {session.turnCount === 1 ? "question" : "questions"}.
          </p>
        </div>
      </div>
    </main>
  );
}
