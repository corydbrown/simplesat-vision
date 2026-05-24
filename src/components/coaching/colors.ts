/**
 * Category-color mapping for the coaching surface. Each scorecard category
 * is assigned a hue from the production palette by stable `order` index,
 * cycling if a future scorecard has >5 categories. Hue tokens are the
 * production theme tokens (DESIGN.md → "Production hue palette") — never
 * raw Tailwind hues — so dark mode flips correctly.
 *
 * The mapping is data-driven (by order, not by hardcoded id) so this layer
 * keeps working when a customer's scorecard has different category ids.
 */

export type CoachingHue = "blue" | "green" | "yellow" | "purple" | "teal";

const HUE_CYCLE: CoachingHue[] = ["blue", "green", "yellow", "purple", "teal"];

/** Pick a stable hue for a category by its `order` field. */
export function hueForCategoryOrder(order: number): CoachingHue {
  const idx = ((order % HUE_CYCLE.length) + HUE_CYCLE.length) % HUE_CYCLE.length;
  return HUE_CYCLE[idx];
}

export type HueTokens = {
  text: string;
  textDark: string;
  bg: string;
  bgSoft: string;
  border: string;
  borderSoft: string;
  ring: string;
  stroke: string;
};

export const HUE_TOKENS: Record<CoachingHue, HueTokens> = {
  blue: {
    text: "text-blue-dark",
    textDark: "text-blue-darker",
    bg: "bg-blue",
    bgSoft: "bg-blue-lighter",
    border: "border-blue",
    borderSoft: "border-blue-light",
    ring: "ring-blue",
    stroke: "stroke-blue",
  },
  green: {
    text: "text-green-dark",
    textDark: "text-green-darker",
    bg: "bg-green",
    bgSoft: "bg-green-lighter",
    border: "border-green",
    borderSoft: "border-green-light",
    ring: "ring-green",
    stroke: "stroke-green",
  },
  yellow: {
    text: "text-yellow-dark",
    textDark: "text-yellow-darker",
    bg: "bg-yellow",
    bgSoft: "bg-yellow-lighter",
    border: "border-yellow",
    borderSoft: "border-yellow-light",
    ring: "ring-yellow",
    stroke: "stroke-yellow",
  },
  purple: {
    text: "text-purple-dark",
    textDark: "text-purple-darker",
    bg: "bg-purple",
    bgSoft: "bg-purple-lighter",
    border: "border-purple",
    borderSoft: "border-purple-light",
    ring: "ring-purple",
    stroke: "stroke-purple",
  },
  teal: {
    text: "text-teal-dark",
    textDark: "text-teal-darker",
    bg: "bg-teal",
    bgSoft: "bg-teal-lighter",
    border: "border-teal",
    borderSoft: "border-teal-light",
    ring: "ring-teal",
    stroke: "stroke-teal",
  },
};

/** Overall-score → hue, matching the in-page tight-mockup mapping. */
export function hueForOverallScore(score: number): CoachingHue {
  if (score >= 90) return "green";
  if (score >= 75) return "teal";
  if (score >= 60) return "yellow";
  return "purple";
}
