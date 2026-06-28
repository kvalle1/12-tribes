"use client";

import { useState } from "react";

/**
 * The Subject's shareable 360 observer link with a copy button (issue #8). The
 * absolute URL is assembled on the client from the current origin and the
 * server-supplied `path` (`/a/<shareToken>`), so it stays correct across
 * environments without the server needing to know its own public URL.
 */
export function ShareLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  const url =
    typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable (insecure context / denied permission);
      // the link is shown in full so it can still be copied by hand.
    }
  };

  return (
    <div className="flex flex-wrap items-stretch gap-2.5">
      <code className="min-w-0 flex-1 truncate rounded-[2px] border border-hair bg-white px-4 py-3 text-[14px] text-ink">
        {url}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-live="polite"
        className="rounded-[2px] bg-ink px-[24px] py-3 text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
