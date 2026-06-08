export const dynamic = "force-dynamic";
import { signIn } from "@/auth";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function SignInPage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-[#0d0d0d] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Tribe Index</h1>
          <p className="text-zinc-400 text-sm">
            Enter your email to receive a sign-in link.
          </p>
        </div>

        <form
          action={async (formData: FormData) => {
            "use server";
            await signIn("resend", formData);
          }}
          className="space-y-4"
        >
          <input
            type="email"
            name="email"
            placeholder="you@example.com"
            required
            className="w-full rounded-lg bg-white/[0.05] border border-white/[0.1] px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-white text-black font-semibold py-3 hover:bg-zinc-200 transition-colors"
          >
            Send magic link
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-600">
          No password. No account required. Just click the link we email you.
        </p>
      </div>
    </main>
  );
}
