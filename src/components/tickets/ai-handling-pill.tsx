import type { AiHandling, AiResolutionState } from "@/db/schema";

const HANDLING_STYLES: Record<AiHandling, string> = {
  bot_only: "bg-teal-lighter text-teal-darker",
  hybrid: "bg-yellow-lighter text-yellow-darker",
  human_only: "bg-grey-lighter text-grey-darker",
};

const HANDLING_LABELS: Record<AiHandling, string> = {
  bot_only: "Bot only",
  hybrid: "Hybrid",
  human_only: "Human only",
};

export function AiHandlingPill({ handling }: { handling: AiHandling }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-sm font-medium ${HANDLING_STYLES[handling]}`}
    >
      {HANDLING_LABELS[handling]}
    </span>
  );
}

// Source-verbatim free text (Intercom adds states over time), so unmapped
// values degrade to a neutral pill with a humanized label rather than
// rendering nothing. Add an entry when a new state earns a distinct color.
const RESOLUTION_STYLES: Record<string, string> = {
  assumed_resolution: "bg-green-lighter text-green-darker",
  confirmed_resolution: "bg-green-lighter text-green-darker",
  routed_to_team: "bg-yellow-lighter text-yellow-darker",
  abandoned: "bg-grey-lighter text-grey-darker",
};

const RESOLUTION_LABELS: Record<string, string> = {
  assumed_resolution: "Assumed resolution",
  confirmed_resolution: "Confirmed resolution",
  routed_to_team: "Routed to team",
  abandoned: "Abandoned",
};

const NEUTRAL = "bg-grey-lighter text-grey-darker";

function humanize(value: string): string {
  const spaced = value.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function AiResolutionStatePill({ state }: { state: AiResolutionState }) {
  const className = RESOLUTION_STYLES[state] ?? NEUTRAL;
  const label = RESOLUTION_LABELS[state] ?? humanize(state);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-sm font-medium ${className}`}
    >
      {label}
    </span>
  );
}
