// Deterministic name-to-color mapping. Stable across renders.
const PALETTE = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#eab308", // yellow
  "#84cc16", // lime
  "#22c55e", // green
  "#10b981", // emerald
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#0ea5e9", // sky
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#d946ef", // fuchsia
  "#ec4899", // pink
];

export function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % PALETTE.length;
  return PALETTE[idx];
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

/** DiceBear avatar URL — fun-emoji for humans, bottts for bots. Hits the
 *  DiceBear 9.x HTTP API directly; their CDN handles caching. `size=128`
 *  is the 2x retina target for the largest size the app actually uses (64px
 *  `Avatar size="lg"`). SVG is vector, so `size` only sets the SVG viewBox
 *  — quality is identical at any render size; the param is for parity with
 *  the SVP-234 mockup convention. */
export type DicebearStyle = "fun-emoji" | "bottts";

export function dicebearUrl(seed: string, style: DicebearStyle = "fun-emoji"): string {
  const params = new URLSearchParams({ seed, size: "128" });
  return `https://api.dicebear.com/9.x/${style}/svg?${params.toString()}`;
}
