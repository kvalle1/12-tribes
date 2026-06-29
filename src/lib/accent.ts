/**
 * Per-tribe accent color: maps a tribe's Tailwind color name (the `color` field
 * in `tribes.ts`) to the hex used for the `--accent` CSS variable. A color with
 * no entry falls back to brass, matching the home and tribe-detail pages.
 *
 * The home page (`page.tsx`) and the tribe detail page keep their own inline
 * copies of this map; this shared helper is used by the assessment result view
 * so the enrichment slice doesn't add a fourth copy. When adding a tribe or
 * color, keep the entries here in sync with those maps.
 */
const ACCENT_HEX: Record<string, string> = {
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

const ACCENT_FALLBACK = "#a9842f";

export function accentHex(color: string): string {
  return ACCENT_HEX[color] ?? ACCENT_FALLBACK;
}
