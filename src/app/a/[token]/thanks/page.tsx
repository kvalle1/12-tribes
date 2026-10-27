import Link from "next/link";
import { getSubjectByToken } from "@/lib/observer/repository";

/**
 * Confirmation shown after an Observer submits (issue #8). It stays anonymous —
 * no result, no other observers' answers, nothing identifying. If the token
 * resolves we personalize the thank-you with the Subject's name; otherwise we
 * still confirm generically rather than error.
 */
export default async function ObserverThanksPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const subject = await getSubjectByToken(token);
  const name = subject?.subjectName;

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[560px] px-8 py-[120px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <p className="mt-10 text-[12px] uppercase tracking-[0.2em] text-faint">
          Reflection received
        </p>
        <h1 className="mt-3 font-serif text-[40px] font-semibold leading-[1.05]">
          Thank you
        </h1>
        <p className="mt-3 max-w-[460px] text-[16px] text-muted">
          Your read{name ? ` of ${name}` : ""} has been recorded anonymously.
          Once enough people have weighed in, {name ?? "they"} will see how
          others see {name ? "them" : "themselves"} alongside their own answers.
        </p>

        <div className="mt-10">
          <Link
            href="/"
            className="rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
          >
            Explore the twelve tribes
          </Link>
        </div>
      </div>
    </main>
  );
}
