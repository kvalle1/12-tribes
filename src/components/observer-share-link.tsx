"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The Subject's shareable 360 observer link (issue #8). Renders the full,
 * copyable URL — composed server-side from the request host so it works behind a
 * proxy without touching `window` — plus a one-click copy.
 */
export function ObserverShareLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable (insecure context / denied permission);
      // the link stays visible and selectable so it can be copied by hand.
    }
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <input
        type="text"
        readOnly
        value={url}
        aria-label="Your shareable observer link"
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded-[2px] border border-hair bg-white px-3 py-[10px] text-[14px] text-ink"
      />
      <button
        type="button"
        onClick={copy}
        className={cn(
          "rounded-[2px] px-[22px] py-[11px] text-[13px] tracking-[0.08em] transition-colors",
          copied ? "bg-gold/15 text-ink" : "bg-ink text-bone hover:bg-black",
        )}
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
