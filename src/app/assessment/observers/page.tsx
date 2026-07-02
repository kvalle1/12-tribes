import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { ComparisonReport } from "@/components/comparison-report";
import { ObserverShareLink } from "@/components/observer-share-link";

/**
 * The Subject's 360 comparison report (issue #9, ADR-0003): how they see
 * themselves beside how their anonymous Observers see them. Login-gated — an
 * unauthenticated visitor is routed through sign-in, and a signed-in user who
 * hasn't taken the assessment is sent to start it (there is no Subject to
 * compare against without a saved result).
 *
 * The report itself unlocks only once at least three Observers have responded;
 * until then `ComparisonReport` renders a locked state with progress. The
 * observer share link is shown below so the Subject can gather the responses
 * needed to unlock it.
 */
export default async function ObserverReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=${encodeURIComponent("/assessment/observers")}`,
    );
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponses(session.user.id);
  const shareUrl = `${await observerLinkBase()}/a/${row.shareToken}`;

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        <ComparisonReport words={row.words} responses={responses} />

        <section className="mt-16 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Invite more observers
          </p>
          <p className="mt-2 max-w-[520px] text-[15px] text-muted">
            Send this link to people who know you well. Each one anonymously
            picks the words that describe you.
          </p>
          <ObserverShareLink url={shareUrl} />
        </section>
      </div>
    </main>
  );
}

/**
 * The origin the shareable observer link is built against. Prefers the
 * configured `AUTH_URL` (trusted, set per deployment) so a forwarded `Host`
 * header can't change the link a Subject copies; falls back to the request host
 * for local/dev where `AUTH_URL` may be unset, and finally to a relative path.
 * Mirrors the result page's link composition.
 */
async function observerLinkBase(): Promise<string> {
  const configured = process.env.AUTH_URL?.replace(/\/+$/, "");
  if (configured) return configured;

  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  if (!host) return "";

  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}
