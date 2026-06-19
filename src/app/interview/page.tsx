import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { findActiveSession } from "@/db/interview-repository";
import { presentView } from "@/lib/interview/session";
import { startInterview, submitAnswer } from "./actions";

/**
 * Interview entry point. Server-authoritative and resumable: it reads the
 * participant's in-progress Session from Postgres on every request, so a refresh
 * or a reopened tab lands back on the same pending question (ADR-0009, ADR-0011).
 * Only the {@link presentView} projection reaches the page — never the running
 * scoring profile.
 */
export default async function InterviewPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const active = await findActiveSession(session.user.id);

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

        {active ? (
          <Question view={presentView(active)} />
        ) : (
          <Begin />
        )}
      </div>
    </main>
  );
}

function Begin() {
  return (
    <>
      <h1 className="mt-3 font-serif text-[40px] font-semibold leading-[1.05]">
        A conversation about how you&rsquo;re wired
      </h1>
      <p className="mt-4 text-[16px] text-muted">
        The Interview asks open questions and listens for the tribe wiring in
        your answers. It runs independently of the other assessments. Your
        progress is saved as you go, so you can step away and pick up where you
        left off.
      </p>
      <form action={startInterview} className="mt-8">
        <button
          type="submit"
          className="rounded-[2px] bg-ink px-[34px] py-[14px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
        >
          Begin the Interview
        </button>
      </form>
    </>
  );
}

function Question({
  view,
}: {
  view: ReturnType<typeof presentView>;
}) {
  if (view.kind === "complete") {
    // The Session finished between load and render; show the result instead.
    redirect("/interview/result");
  }

  return (
    <>
      <h1 className="mt-3 font-serif text-[24px] font-medium text-faint">
        Question {view.index + 1}
      </h1>
      <p className="mt-4 font-serif text-[28px] leading-[1.25]">{view.prompt}</p>

      <form action={submitAnswer} className="mt-8 flex flex-col gap-3">
        <label htmlFor="answer" className="sr-only">
          Your answer
        </label>
        <textarea
          id="answer"
          name="answer"
          required
          rows={6}
          autoFocus
          placeholder="Take your time — a few sentences in your own words."
          className="rounded-[2px] border border-hair bg-white px-4 py-3 text-[16px] leading-[1.5] outline-none focus:border-gold"
        />
        <div>
          <button
            type="submit"
            className="rounded-[2px] bg-ink px-[34px] py-[14px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
          >
            Continue
          </button>
        </div>
      </form>

      <p className="mt-6 text-[13px] text-faint">
        Your progress is saved automatically.
      </p>
    </>
  );
}
