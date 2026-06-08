"use client";

import { signOut } from "next-auth/react";

/**
 * Signs out via the client `signOut()` so the `SessionProvider` (and every
 * `useSession()` reader, like the nav) is notified and updates immediately.
 *
 * A server-action sign-out clears the cookie correctly, but its redirect is an
 * in-app RSC navigation that does not remount the persistent SessionProvider —
 * leaving the client session cache stale until the next full reload.
 */
export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ redirectTo: "/" })}
      className="rounded-[2px] border border-ink px-[28px] py-[12px] text-[13px] tracking-[0.08em] text-ink transition-colors hover:bg-ink hover:text-bone"
    >
      Sign out
    </button>
  );
}
