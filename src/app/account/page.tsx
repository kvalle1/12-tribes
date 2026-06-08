import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { ClientSession } from "@/components/client-session";

/**
 * Authenticated landing page. Demonstrates that the session is readable on the
 * server (`auth()` below) and on the client (`<ClientSession />`), and lets the
 * user sign out. Unauthenticated visitors are redirected to /signin.
 */
export default async function AccountPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/signin");
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
          Your account
        </h1>

        <div className="mt-8 flex flex-col gap-4">
          <div className="rounded-[2px] border border-hair p-5">
            <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
              Server component · auth()
            </div>
            <div className="mt-2 font-serif text-[18px]">
              Signed in as{" "}
              <span className="text-gold">{session.user.email}</span>
            </div>
          </div>

          <ClientSession />
        </div>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
          className="mt-8"
        >
          <button
            type="submit"
            className="rounded-[2px] border border-ink px-[28px] py-[12px] text-[13px] tracking-[0.08em] text-ink transition-colors hover:bg-ink hover:text-bone"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
