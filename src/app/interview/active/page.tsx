import { redirect } from "next/navigation";
import { currentTurn } from "@/lib/interview/flow";
import { interviewRepository } from "@/lib/interview/server";
import { readSessionId } from "@/lib/interview/session-cookie";
import { submitAnswer } from "../actions";

/**
 * The active Turn. Loads the server-authoritative Session from the cookie pointer
 * and renders only the pending question — reloading or reopening the tab lands
 * here and resumes at the same Turn, because the state lives on the server.
 */
export default async function ActiveTurnPage() {
  const id = await readSessionId();
  if (!id) redirect("/interview");

  const session = await interviewRepository.load(id);
  if (!session) redirect("/interview");
  if (session.status === "complete") redirect("/interview/result");

  const turn = currentTurn(session);
  if (!turn) redirect("/interview/result");

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[640px] px-8 py-[120px]">
        <div className="text-[11px] uppercase tracking-[0.18em] text-faint">
          The Interview · Question {turn.index + 1}
        </div>

        <h1 className="mt-6 font-serif text-[30px] font-medium leading-[1.2]">
          {turn.question}
        </h1>

        <form action={submitAnswer} className="mt-8 flex flex-col gap-3">
          <label htmlFor="answer" className="sr-only">
            Your answer
          </label>
          <textarea
            id="answer"
            name="answer"
            required
            rows={7}
            autoFocus
            placeholder="Take your time — a few sentences in your own words."
            className="resize-y rounded-[2px] border border-hair bg-white px-4 py-3 text-[16px] leading-[1.6] outline-none focus:border-gold"
          />
          <button
            type="submit"
            className="self-start rounded-[2px] bg-ink px-[34px] py-[14px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
          >
            Continue
          </button>
        </form>
      </div>
    </main>
  );
}
