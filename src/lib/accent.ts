/**
 * Maps a tribe's Tailwind color name (`Tribe.color`) to the accent hex used for
 * the per-tribe `--accent` CSS variable. Falls back to brass for an unknown
 * color (matching the existing inline lookups).
 *
 * NOTE: an equivalent lookup is currently inlined in `app/page.tsx` and
 * `app/tribes/[slug]/page.tsx`; new code shares this one. Consolidating those
 * two onto this helper is a follow-up outside this change's scope.
 */
export function accentHex(color: string): string {
  const map: Record<string, string> = {
    amber: "#b8860b",
    violet: "#7c5cbf",
    blue: "#2f6fb0",
    emerald: "#2f8f63",
    orange: "#c2691f",
    red: "#b23535",
    slate: "#6b7280",
    cyan: "#1f97aa",
    lime: "#6f9420",
    zinc: "#7c7c85",
    yellow: "#b8961a",
    rose: "#bf3a52",
  };
  return map[color] ?? "#a9842f";
}
