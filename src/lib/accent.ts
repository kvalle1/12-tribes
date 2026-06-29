/**
 * Maps a tribe's Tailwind color name (the `color` field on `Tribe`) to the
 * accent hex used across the UI — the home-page tribe rows, the tribe detail
 * page, and the assessment result view. A color with no entry falls back to
 * brass rather than erroring.
 *
 * When adding a tribe or a new color, add the matching key here. `page.tsx` and
 * the tribe detail page keep their own inline copies (documented in CLAUDE.md);
 * the result view (issue #6) reads from this shared helper.
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
