import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { interviewSessions } from "@/db/schema";
import { INTERVIEW_SESSION_COOKIE } from "@/lib/interview/session";
import { startInterview } from "../actions";

/**
 * Stub result page for the walking skeleton. The real result — Strength
 * Profile, Posture, Primary/Contenders, score trace — arrives with the scoring
 * slices (#16–#21). For now it confirms the end-to-end path completed and that
 * the Session was persisted.
 */
export default async function InterviewResultPage() {
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

  // No session, or it isn't finished yet → back to the flow.
  if (!row) redirect("/interview");
  if (row.status !== "complete") redirect("/interview");

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
          You answered {row.turnCount}{" "}
          {row.turnCount === 1 ? "question" : "questions"}. Your tribe result —
          Strength Profile, Posture, and the reasoning behind it — is computed in
          a later slice; this is the walking skeleton confirming the flow runs
          end to end and your answers were saved.
        </p>

        <div className="mt-8 rounded-[2px] border border-hair p-5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
            Your answers
          </div>
          <ul className="mt-3 flex flex-col gap-4">
            {row.turns.map((turn) => (
              <li key={turn.index}>
                <div className="font-serif text-[16px] text-ink">
                  {turn.question}
                </div>
                <p className="mt-1 text-[15px] text-muted">{turn.answer}</p>
              </li>
            ))}
          </ul>
        </div>

        <form action={startInterview} className="mt-8">
          <button
            type="submit"
            className="rounded-[2px] border border-ink px-[28px] py-[12px] text-[13px] tracking-[0.08em] text-ink transition-colors hover:bg-ink hover:text-bone"
          >
            Take it again
          </button>
        </form>
      </div>
    </main>
  );
}
