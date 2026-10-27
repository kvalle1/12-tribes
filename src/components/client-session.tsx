"use client";

import { useSession } from "next-auth/react";

/**
 * Reads the session in a Client Component via Auth.js's `useSession()`.
 * Rendered on the /account page alongside the server-side readout so both
 * paths are demonstrably working.
 */
export function ClientSession() {
  const { status, data } = useSession();

  return (
    <div className="rounded-[2px] border border-hair p-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
        Client component · useSession()
      </div>
      <div className="mt-2 font-serif text-[18px]">
        {status === "loading" && "Loading session…"}
        {status === "authenticated" && (
          <>
            Signed in as{" "}
            <span className="text-gold">{data.user?.email ?? "(no email)"}</span>
          </>
        )}
        {status === "unauthenticated" && "No active session."}
      </div>
    </div>
  );
}
