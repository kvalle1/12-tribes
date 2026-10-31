import Link from "next/link";
import { auth } from "@/auth";
import { shuffledWordList } from "@/lib/assessment/selection";
import { WordSelector } from "@/components/word-selector";
import { getSubjectByToken } from "@/lib/observer/repository";
import { submitObserverResponse } from "./actions";

/**
 * The anonymous 360 Observer page (issue #8, ADR-0003). Reached via a Subject's
 * shareable link `/a/[token]` — no sign-in required. The Observer sees the same
 * flat, shuffled, unlabeled word list and 8–15 constraint as the Subject, but is
 * prompted to describe the named Subject rather than themselves. The token is
 * bound to the submit action server-side; an unknown token renders a graceful
 * "link not found" instead of the form.
 */
export default async function ObserverPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const subject = await getSubjectByToken(token);

  if (!subject) {
    return <InvalidLink />;
  }

  // The read is about the Subject, so the Subject can't answer it about
  // themselves — that would be self-scoring under the "others" view and could
  // self-unlock the ≥3 gate (issue #193). Show a gentle note instead of the
  // form; the server action enforces the same block. This page is public, so a
  // session-layer failure must fall back to "not signed in" (show the form)
  // rather than 500 an anonymous Observer.
  const viewerId = await currentUserId();
  if (viewerId === subject.subjectId) {
    return <OwnLinkNotice subjectName={subject.subjectName} />;
  }

  const words = shuffledWordList();

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[760px] px-8 py-[88px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <p className="mt-10 text-[12px] uppercase tracking-[0.2em] text-faint">
          A 360 reflection
        </p>
        <h1 className="mt-3 font-serif text-[40px] font-semibold leading-[1.05]">
          Which words describe {subject.subjectName}?
        </h1>
        <p className="mt-3 max-w-[560px] text-[16px] text-muted">
          Someone asked for your honest read. Choose the words that genuinely fit
          how {subject.subjectName} is wired — not how they&rsquo;d like to be
          seen. Your response is{" "}
          <span className="text-ink">completely anonymous</span>: no name, no
          relationship, nothing tying it back to you. The order is shuffled each
          time.
        </p>

        <WordSelector
          words={words}
          action={submitObserverResponse.bind(null, token)}
          submitLabel="Share my read"
        />
      </div>
    </main>
  );
}

/**
 * Shown when the signed-in viewer is the Subject the link is about (issue #193).
 * They can't be their own Observer, so we explain the link is for other people
 * and point them back to their own result rather than presenting the form.
 */
function OwnLinkNotice({ subjectName }: { subjectName: string }) {
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
          This is your link
        </p>
        <h1 className="mt-3 font-serif text-[40px] font-semibold leading-[1.05]">
          A 360 read is for others
        </h1>
        <p className="mt-3 max-w-[460px] text-[16px] text-muted">
          You&rsquo;re signed in as {subjectName} — the person this reflection is
          about — so this one&rsquo;s not for you to fill in. Send the link to 3–5
          people who know you well, and their reads will appear on your result.
        </p>

        <div className="mt-10">
          <Link
            href="/assessment/result"
            className="rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
          >
            Back to your result
          </Link>
        </div>
      </div>
    </main>
  );
}

/**
 * The signed-in viewer's id, or `null` when not signed in. On a public page a
 * session-store hiccup or misconfiguration must not take down the Observer form,
 * so any failure is treated as "not signed in" (issue #193 review).
 */
async function currentUserId(): Promise<string | null> {
  try {
    const session = await auth();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

/** Friendly, in-theme handling of an unknown or stale observer link. */
function InvalidLink() {
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
          This link isn&rsquo;t valid
        </h1>
        <p className="mt-3 max-w-[460px] text-[16px] text-muted">
          The reflection link you followed doesn&rsquo;t match anyone. It may have
          been mistyped, or the person may have retaken their assessment. Ask them
          for a fresh link.
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
