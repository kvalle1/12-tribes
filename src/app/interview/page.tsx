import Link from "next/link";
import { redirect } from "next/navigation";
import { interviewRepository } from "@/lib/interview/server";
import { readSessionId } from "@/lib/interview/session-cookie";
import { startInterview } from "./actions";

/**
 * Interview entry point. If the visitor already has an in-progress Session
 * (cookie pointer), resume it; otherwise offer to begin a fresh run.
 */
export default async function InterviewStartPage() {
  const id = await readSessionId();
  if (id) {
    const session = await interviewRepository.load(id);
    if (session?.status === "in_progress") redirect("/interview/active");
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
          The Interview
        </h1>
        <p className="mt-3 text-[16px] text-muted">
          A guided conversation that listens for how you&rsquo;re wired and names
          the tribe behind it. Answer in your own words — there are no right
          answers, and nothing you say is scored against a key you can see.
        </p>

        <form action={startInterview} className="mt-8">
          <button
            type="submit"
            className="rounded-[2px] bg-ink px-[34px] py-[14px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
          >
            Begin the Interview
          </button>
        </form>
      </div>
    </main>
  );
}
