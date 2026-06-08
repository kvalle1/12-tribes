export const dynamic = "force-dynamic";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import SignOutButton from "@/components/sign-out-button";
import SessionDisplay from "@/components/session-display";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/signin");

  return (
    <main className="min-h-screen bg-[#0d0d0d] text-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between mb-12">
          <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
            ← Tribe Index
          </Link>
          <SignOutButton />
        </div>

        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-zinc-400 mb-10">You&apos;re signed in.</p>

        {/* Server component session readout */}
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5 mb-4">
          <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Server Component</p>
          <p className="text-zinc-200 text-sm">
            Email: <span className="text-white font-medium">{session.user?.email}</span>
          </p>
          <p className="text-zinc-500 text-xs mt-1">
            User ID: {session.user?.id ?? "—"}
          </p>
        </div>

        {/* Client component session readout */}
        <SessionDisplay />
      </div>
    </main>
  );
}
