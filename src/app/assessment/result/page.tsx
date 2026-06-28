import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { AssessmentResult } from "@/components/assessment-result";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * This page is shown both right after submitting and when the Subject returns to
 * their saved result; it renders the shared `<AssessmentResult />` view (#6) so
 * both paths look identical. The profile page (#18) renders the same component.
 */
export default async function AssessmentResultPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/result")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  return (
    <main className="min-h-screen bg-bone text-ink">
      <AssessmentResult
        words={row.words}
        primarySlug={row.primarySlug}
        secondarySlug={row.secondarySlug}
      />
    </main>
  );
}
