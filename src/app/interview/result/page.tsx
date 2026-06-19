import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { findLatestCompleteSession } from "@/db/interview-repository";

/**
 * Stub Interview result. This slice has no scoring yet (#16), so the page only
 * confirms the run completed and that the Session was persisted and reloaded
 * from the server — the real Strength Profile and Attribution arrive later.
 * It renders nothing from the server-only running profile.
 */
export default async function InterviewResultPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const completed = await findLatestCompleteSession(session.user.id);
  if (!completed) {
    // No finished interview yet — send them to start one.
    redirect("/interview");
  }

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[640px] px-8 py-[120px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <div className="mt-10 text-[11px] uppercase tracking-[0.16em] text-faint">
          The Interview
        </div>
        <h1 className="mt-3 font-serif text-[40px] font-semibold leading-[1.05]">
          Interview complete
        </h1>

        <div className="mt-8 rounded-[2px] border border-gold/40 bg-gold/5 p-6">
          <div className="font-serif text-[20px]">
            Thank you — your answers are recorded.
          </div>
          <p className="mt-2 text-[15px] text-muted">
            You answered{" "}
            <span className="text-gold">
              {completed.turns.length}
              {completed.turns.length === 1 ? " question" : " questions"}
            </span>
            . Your tribe result from the Interview will appear here once scoring
            is in place — that&rsquo;s the next step we&rsquo;re building.
          </p>
        </div>

        <div className="mt-8">
          <Link
            href="/account"
            className="text-[13px] uppercase tracking-[0.12em] text-muted transition-colors hover:text-ink"
          >
            ← Back to your account
          </Link>
        </div>
      </div>
    </main>
  );
}
