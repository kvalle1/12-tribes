import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import {
  isReportUnlocked,
  MIN_OBSERVERS_TO_UNLOCK,
} from "@/lib/observer/aggregate";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * beside the equal-weight average of their anonymous Observers, unlocking only
 * once at least three people have responded.
 *
 * Login-gated like the rest of the assessment (ADR-0004): an unauthenticated
 * visitor routes through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it (there's no Subject to compare against yet).
 * The observer responses are loaded and scored entirely on the server; the
 * aggregation and the word→tribe mapping never reach the client (ADR-0009).
 */
export default async function AssessmentReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponses(session.user.id);
  const unlocked = isReportUnlocked(responses.length);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        {unlocked ? (
          <ComparisonReport selfWords={row.words} observerWords={responses} />
        ) : (
          <LockedReport responded={responses.length} shareToken={row.shareToken} />
        )}
      </div>
    </main>
  );
}

/**
 * The pre-unlock state: how many of the required Observers have responded so
 * far, and a nudge back to the share link so the Subject can invite more. We
 * show a count, never anything about *who* responded — the responses stay
 * anonymous even in aggregate before unlock.
 */
function LockedReport({
  responded,
  shareToken,
}: {
  responded: number;
  shareToken: string;
}) {
  const remaining = Math.max(MIN_OBSERVERS_TO_UNLOCK - responded, 0);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-2 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.05]">
        A few more reads to go
      </h1>
      <p className="mt-4 max-w-[560px] text-[16px] leading-relaxed text-muted">
        The comparison unlocks once at least {MIN_OBSERVERS_TO_UNLOCK} people
        have responded &mdash; enough for the &ldquo;others&rdquo; average to
        mean something and to keep every response anonymous.
      </p>

      <div className="mt-10 flex items-center gap-4">
        <div className="flex gap-2" aria-hidden>
          {Array.from({ length: MIN_OBSERVERS_TO_UNLOCK }).map((_, i) => (
            <span
              key={i}
              className={`h-2.5 w-10 rounded-full ${i < responded ? "bg-gold" : "bg-hair"}`}
            />
          ))}
        </div>
        <p className="text-[14px] text-muted">
          <span className="font-semibold text-ink">{responded}</span> of{" "}
          {MIN_OBSERVERS_TO_UNLOCK} responded
        </p>
      </div>

      <p className="mt-10 max-w-[560px] text-[15px] text-muted">
        {remaining === 1
          ? "Just one more response and your comparison opens up."
          : `Share your observer link with ${remaining} more people who know you well.`}
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-[22px]">
        <Link
          href="/assessment/result"
          className="rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
        >
          Get your share link
        </Link>
        <span className="text-[12px] text-faint">
          Link: <code className="text-muted">/a/{shareToken}</code>
        </span>
      </div>
    </div>
  );
}
