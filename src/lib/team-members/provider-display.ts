/** Client-safe display labels for AI agent `provider` values. The DB column is
 *  free text (`team_members.provider`) so the canonical detection list lives in
 *  the `server-only` ai-detection module — this is the parallel UI map. Unknown
 *  values fall back to a humanized version of the raw token so a new vendor
 *  reads sensibly even before this map is updated. */
const PROVIDER_LABELS: Record<string, string> = {
  intercom_fin: "Intercom Fin",
  decagon: "Decagon",
  sierra: "Sierra",
  openai_assistant: "OpenAI Assistant",
  anthropic_custom: "Anthropic (custom)",
  unknown: "AI agent",
};

export function providerLabel(provider: string | null | undefined): string {
  if (!provider) return "—";
  const known = PROVIDER_LABELS[provider];
  if (known) return known;
  return provider
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
