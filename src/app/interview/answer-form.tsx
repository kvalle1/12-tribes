"use client";

import { useFormStatus } from "react-dom";
import { submitAnswer } from "@/lib/interview/actions";

/**
 * The free-text answer form. It posts only the answer to the `submitAnswer`
 * Server Action — the session is identified server-side by cookie, so no
 * scoring state is held or sent by the client (ADR-0009).
 */
export function AnswerForm() {
  return (
    <form action={submitAnswer} className="mt-8 flex flex-col gap-4">
      <textarea
        name="answer"
        required
        rows={6}
        placeholder="Answer in your own words…"
        className="w-full resize-y rounded-[2px] border border-hair bg-white p-4 font-serif text-[18px] leading-[1.5] text-ink outline-none focus:border-ink"
      />
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded-[2px] bg-ink px-7 py-3 text-[13px] uppercase tracking-[0.16em] text-bone transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Saving…" : "Continue"}
    </button>
  );
}
