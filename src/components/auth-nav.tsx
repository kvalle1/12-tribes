"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

/**
 * Client-side session readout, surfaced in the top nav.
 * Uses Auth.js's `useSession()` (client) to prove the session is readable on
 * the client and reflected in the UI. The server-side counterpart lives on the
 * /account page via `auth()`.
 */
export function AuthNav() {
  const { status, data } = useSession();

  if (status === "loading") {
    return <span className="text-faint">…</span>;
  }

  if (status === "authenticated") {
    return (
      <Link href="/account" className="transition-colors hover:text-ink">
        {data.user?.email ?? "Account"}
      </Link>
    );
  }

  return (
    <Link href="/signin" className="transition-colors hover:text-ink">
      Sign in
    </Link>
  );
}
