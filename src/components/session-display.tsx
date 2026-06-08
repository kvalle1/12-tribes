"use client";

import { useSession } from "next-auth/react";

export default function SessionDisplay() {
  const { data: session, status } = useSession();

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5">
      <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Client Component</p>
      {status === "loading" && (
        <p className="text-zinc-500 text-sm">Loading session...</p>
      )}
      {status === "authenticated" && (
        <>
          <p className="text-zinc-200 text-sm">
            Email: <span className="text-white font-medium">{session.user?.email}</span>
          </p>
          <p className="text-zinc-500 text-xs mt-1">
            Status: <span className="text-emerald-400">authenticated</span>
          </p>
        </>
      )}
    </div>
  );
}
