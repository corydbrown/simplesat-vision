import type { AiHandling } from "@/db/schema";

/** The three independent conversation-level AI facts stored on a ticket. */
export type AiHandlingFacts = {
  aiAgentParticipated: boolean;
  handedOffToHuman: boolean;
};

/** Derive the bot-only / human-only / hybrid segment from the stored facts.
 *  Single source of truth so Reports + QA can't drift into contradictory
 *  stored booleans (the reason `bot_handled` is computed, not a column):
 *  - `human_only` — no AI agent participated (pure human, or pre-AI ticket)
 *  - `bot_only`   — AI participated and no human took over (deflected)
 *  - `hybrid`     — AI participated and a human took over (escalation) */
export function classifyAiHandling(facts: AiHandlingFacts): AiHandling {
  if (!facts.aiAgentParticipated) return "human_only";
  return facts.handedOffToHuman ? "hybrid" : "bot_only";
}

/** Convenience: did the bot fully handle the ticket without a human takeover?
 *  This is the `bot_handled` signal the brief named — derived, not stored. */
export function isBotHandled(facts: AiHandlingFacts): boolean {
  return classifyAiHandling(facts) === "bot_only";
}
