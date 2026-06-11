import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loadSession } from "@/lib/interview/repository";
import { SESSION_COOKIE } from "@/lib/interview/session";

/**
 * Stub result page for the walking skeleton (slice 1). Real scoring, the
 * Strength Profile, and the score trace arrive in later slices — for now this
 * confirms the end-to-end path completed and echoes the answers on record.
 */
export default async function InterviewResultPage() {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  const session = id ? await loadSession(id) : null;

  if (!session || session.status !== "complete") {
    redirect("/interview");
  }

  const answered = session.turns.filter((turn) => turn.answer !== null);

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
          Interview complete
        </h1>

        <p className="mt-6 font-serif text-[20px] leading-[1.5] text-muted">
          Your result is being prepared. Tribe scoring and your Strength Profile
          arrive in a later release — this confirms the interview ran end to end
          and your answers were saved.
        </p>

        <div className="mt-10 flex flex-col gap-4">
          {answered.map((turn) => (
            <div
              key={turn.index}
              className="rounded-[2px] border border-hair p-5"
            >
              <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
                Question {turn.index + 1}
              </div>
              <div className="mt-2 font-serif text-[16px] text-ink">
                {turn.prompt}
              </div>
              <div className="mt-3 border-l-2 border-hair pl-4 font-serif text-[18px] leading-[1.5] text-ink">
                {turn.answer}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
