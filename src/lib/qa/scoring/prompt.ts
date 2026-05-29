/**
 * Prompt construction for LLM-based QA scoring.
 *
 * Extracted from `llm-provider.ts` so the exact prompt that ships to the model
 * is a first-class, importable, testable unit — not a private function buried
 * in the provider. Two consumers today:
 *   1. `LlmScoringProvider.scoreConversation` — the production scoring call.
 *   2. `scripts/render-scoring-prompt.ts` — dev tool that prints the rendered
 *      prompt for a real ticket so it can be pasted into the Anthropic
 *      Console Workbench for iteration.
 *
 * Keeping these pure (ScoringInput → string / schema, no DB / no SDK) is what
 * lets the render tool show the *exact* bytes the provider sends, and lets us
 * unit-test prompt wording without an API key.
 */

import type {
  ScoringCategory,
  ScoringInput,
} from "./types";

export function buildSystemPrompt(input: ScoringInput): string {
  const { scorecard } = input;
  const categoryBlock = scorecard.categories
    .map((cat) => {
      const criteria = cat.criteria
        .map((c, idx) => {
          const weightSuffix =
            c.weightPercent > 0 ? ` [weight: ${c.weightPercent}%]` : "";
          return `    ${idx + 1}. ${c.text}${weightSuffix}`;
        })
        .join("\n");
      return [
        `- ${cat.name} (id: ${cat.id})`,
        `  Description: ${cat.description}`,
        `  Scale: ${describeScale(cat.scaleType)}`,
        cat.isAutofail
          ? "  Auto-fail: failing this category floors the overall score."
          : null,
        "  Criteria:",
        criteria,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  // SVP-228: scorecard-level LLM context. These fields are how the manager
  // tunes the AI's scoring posture for this rubric — read in this exact order
  // so the most general framing (philosophy, bands) lands before the
  // domain-specific overrides (industry, tone).
  const contextSections: string[] = [];
  if (scorecard.scoringPhilosophy) {
    contextSections.push(
      `Scoring philosophy:\n${scorecard.scoringPhilosophy}`,
    );
  }
  if (scorecard.bandDescriptors && scorecard.bandDescriptors.length === 5) {
    const bands = scorecard.bandDescriptors
      .map((d, i) => `  ${i + 1}: ${d}`)
      .join("\n");
    contextSections.push(`Likert-band descriptors:\n${bands}`);
  }
  if (scorecard.domainContext) {
    contextSections.push(`Domain context:\n${scorecard.domainContext}`);
  }
  if (scorecard.toneExpectations) {
    contextSections.push(`Tone expectations:\n${scorecard.toneExpectations}`);
  }
  const contextBlock = contextSections.length
    ? `\n${contextSections.join("\n\n")}\n`
    : "";

  return [
    "You are a QA reviewer evaluating a customer-support conversation against a rubric.",
    "You must call the record_evaluation tool exactly once with your evaluation.",
    contextBlock,
    `Scorecard: ${scorecard.name} (v${scorecard.version})`,
    "Categories:",
    "",
    categoryBlock,
    "",
    "Scoring rules:",
    "- Score every category in the rubric.",
    "- For likert_5 categories: 1 (poor) to 5 (excellent).",
    "- For binary categories: 0 (fail) or 1 (pass).",
    "- For three_state categories: 0 (fail), 1 (partial), or 2 (pass).",
    "- highlightedMessageIds must reference 0-3 message ids from the conversation. Use the exact ids as given in the user message; do not invent ids.",
    "- In reasoning text, refer to messages by their position as 'Message N' (e.g. 'Message 3'), not by raw id.",
    "- coachingNote.strengthPoints and growthPoints: each capped at 3 items, written as direct, specific guidance.",
    "- aiConfidence: float 0-1 reflecting your confidence in the scoring.",
    "- autoFailTriggered: true only if a binary auto-fail category was failed.",
  ].join("\n");
}

export function describeScale(scale: ScoringCategory["scaleType"]): string {
  if (scale === "binary") return "binary (0 = fail, 1 = pass)";
  if (scale === "three_state")
    return "three_state (0 = fail, 1 = partial, 2 = pass)";
  return "likert_5 (1 = poor, 5 = excellent)";
}

export function buildUserPrompt(input: ScoringInput): string {
  const { ticket, messages } = input;
  const header = [
    `Ticket id: ${ticket.id}`,
    `Subject: ${ticket.subject}`,
    `Channel: ${ticket.channel}`,
    `Priority: ${ticket.priority}`,
    `Status: ${ticket.status}`,
    `Tags: ${ticket.tags.join(", ") || "(none)"}`,
  ].join("\n");

  const conversation = messages
    .map((m, idx) => {
      const author = m.authorName
        ? `${m.authorRole} (${m.authorName})`
        : m.authorRole;
      const visibility = m.isPublic ? "" : " [internal]";
      return `Message ${idx + 1} (id: ${m.id}, ${author}${visibility}):\n${m.body}`;
    })
    .join("\n\n");

  return [header, "", "Conversation:", "", conversation].join("\n");
}

export function buildToolSchema(categories: ScoringCategory[]) {
  const categoryIdEnum = categories.map((c) => c.id);
  return {
    type: "object" as const,
    properties: {
      categoryScores: {
        type: "array",
        items: {
          type: "object",
          properties: {
            categoryId: { type: "string", enum: categoryIdEnum },
            score: { type: "number" },
            reasoning: { type: "string" },
            highlightedMessageIds: {
              type: "array",
              items: { type: "string" },
              maxItems: 3,
            },
          },
          required: [
            "categoryId",
            "score",
            "reasoning",
            "highlightedMessageIds",
          ],
        },
      },
      coachingNote: {
        type: "object",
        properties: {
          strengthPoints: {
            type: "array",
            items: { type: "string" },
            maxItems: 3,
          },
          growthPoints: {
            type: "array",
            items: { type: "string" },
            maxItems: 3,
          },
          exampleMessageIds: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["strengthPoints", "growthPoints", "exampleMessageIds"],
      },
      aiConfidence: { type: "number", minimum: 0, maximum: 1 },
      aiReasoningSummary: { type: "string" },
      autoFailTriggered: { type: "boolean" },
    },
    required: [
      "categoryScores",
      "coachingNote",
      "aiConfidence",
      "aiReasoningSummary",
      "autoFailTriggered",
    ],
  };
}
