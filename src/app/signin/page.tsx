import Link from "next/link";
import { signIn } from "@/auth";

/**
 * Passwordless sign-in: enter an email, receive a magic link via Resend.
 * Submitting calls Auth.js `signIn("resend", …)` in a Server Action, which
 * sends the email and redirects to this page with `?sent=1`.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[460px] px-8 py-[120px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <h1 className="mt-10 font-serif text-[40px] font-semibold leading-[1.05]">
          Sign in
        </h1>
        <p className="mt-3 text-[16px] text-muted">
          Enter your email and we&rsquo;ll send you a magic link — no password
          needed.
        </p>

        {sent ? (
          <div className="mt-8 rounded-[2px] border border-gold/40 bg-gold/5 p-5">
            <div className="font-serif text-[18px]">Check your inbox.</div>
            <p className="mt-1 text-[15px] text-muted">
              We sent a sign-in link to your email. Click it to finish signing
              in.
            </p>
          </div>
        ) : (
          <form
            action={async (formData: FormData) => {
              "use server";
              await signIn("resend", {
                email: String(formData.get("email")),
                redirectTo: "/account",
              });
            }}
            className="mt-8 flex flex-col gap-3"
          >
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="rounded-[2px] border border-hair bg-white px-4 py-3 text-[16px] outline-none focus:border-gold"
            />
            <button
              type="submit"
              className="rounded-[2px] bg-ink px-[34px] py-[14px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
            >
              Send magic link
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
