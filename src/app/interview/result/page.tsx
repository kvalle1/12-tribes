import Link from "next/link";
import { redirect } from "next/navigation";
import { interviewRepository } from "@/lib/interview/server";
import { readSessionId } from "@/lib/interview/session-cookie";

/**
 * Stub result page for the walking skeleton. The Interview produces no real
 * Strength Profile yet — later slices add Marker-based scoring and a transparent
 * result. For now this simply confirms the end-to-end path completed and the
 * Session was persisted.
 */
export default async function InterviewResultPage() {
  const id = await readSessionId();
  if (!id) redirect("/interview");

  const session = await interviewRepository.load(id);
  if (!session) redirect("/interview");
  if (session.status !== "complete") redirect("/interview/active");

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[560px] px-8 py-[120px]">
        <div className="text-[11px] uppercase tracking-[0.18em] text-faint">
          The Interview · Result
        </div>

        <h1 className="mt-6 font-serif text-[40px] font-semibold leading-[1.05]">
          Thank you — that&rsquo;s the end of this Interview.
        </h1>
        <p className="mt-3 text-[16px] text-muted">
          Your responses have been recorded. A full Strength Profile — the tribes
          your answers point to, and where you sit on each one&rsquo;s arc — is
          coming in a later release. For now this confirms the Interview ran end
          to end and saved its Session.
        </p>

        <div className="mt-8 rounded-[2px] border border-hair p-5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
            Session summary
          </div>
          <div className="mt-2 font-serif text-[18px]">
            {session.turnCount} question{session.turnCount === 1 ? "" : "s"}{" "}
            answered
          </div>
        </div>

        <div className="mt-8 flex gap-4">
          <Link
            href="/interview"
            className="rounded-[2px] bg-ink px-[34px] py-[14px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
          >
            Start again
          </Link>
          <Link
            href="/"
            className="self-center text-[13px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-ink"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
