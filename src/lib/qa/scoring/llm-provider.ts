/**
 * Real LLM scoring provider. Issues one structured-output call to the
 * configured model, validates the response with zod, and returns the same
 * ScoringOutput shape MockScoringProvider returns.
 *
 * The class is intentionally model-agnostic at its public surface — the
 * model identifier is injected via env, so swapping models (or eventually
 * swapping providers) is a config change, not a code edit. The fact that
 * today's implementation uses the Anthropic SDK is an internal detail.
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type {
  ScoringCategory,
  ScoringCategoryResult,
  ScoringInput,
  ScoringOutput,
  ScoringProvider,
} from "./types";

const llmResponseSchema = z.object({
  categoryScores: z.array(
    z.object({
      categoryId: z.string(),
      score: z.number(),
      reasoning: z.string(),
      highlightedMessageIds: z.array(z.string()),
    }),
  ),
  coachingNote: z.object({
    strengthPoints: z.array(z.string()).max(3),
    growthPoints: z.array(z.string()).max(3),
    exampleMessageIds: z.array(z.string()),
  }),
  aiConfidence: z.number().min(0).max(1),
  aiReasoningSummary: z.string(),
  autoFailTriggered: z.boolean(),
});

type LlmResponse = z.infer<typeof llmResponseSchema>;

export class LlmScoringProvider implements ScoringProvider {
  readonly name: string;
  private client: Anthropic;
  private model: string;

  constructor(opts: { apiKey: string; model: string }) {
    this.client = new Anthropic({ apiKey: opts.apiKey });
    this.model = opts.model;
    this.name = opts.model;
  }

  async scoreConversation(input: ScoringInput): Promise<ScoringOutput> {
    const validMessageIds = new Set(input.messages.map((m) => m.id));
    const systemPrompt = buildSystemPrompt(input);
    const userPrompt = buildUserPrompt(input);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: systemPrompt,
      tools: [
        {
          name: "record_evaluation",
          description:
            "Record the structured QA evaluation of this support conversation against the supplied scorecard.",
          input_schema: buildToolSchema(input.scorecard.categories),
        },
      ],
      tool_choice: { type: "tool", name: "record_evaluation" },
      messages: [{ role: "user", content: userPrompt }],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error(
        `LLM did not return a tool_use block (stop_reason=${response.stop_reason})`,
      );
    }

    const parsed = llmResponseSchema.safeParse(toolUse.input);
    if (!parsed.success) {
      throw new Error(
        `LLM response failed schema validation: ${parsed.error.message}`,
      );
    }

    console.log(
      `[llm-scoring] model=${this.model} ticket=${input.ticket.id} ` +
        `tokens_in=${response.usage.input_tokens} ` +
        `tokens_out=${response.usage.output_tokens}`,
    );

    return projectResponse({
      raw: parsed.data,
      input,
      model: this.model,
      validMessageIds,
    });
  }
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function buildSystemPrompt(input: ScoringInput): string {
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

function describeScale(scale: ScoringCategory["scaleType"]): string {
  if (scale === "binary") return "binary (0 = fail, 1 = pass)";
  if (scale === "three_state")
    return "three_state (0 = fail, 1 = partial, 2 = pass)";
  return "likert_5 (1 = poor, 5 = excellent)";
}

function buildUserPrompt(input: ScoringInput): string {
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

function buildToolSchema(categories: ScoringCategory[]) {
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

// ---------------------------------------------------------------------------
// Response projection
// ---------------------------------------------------------------------------

function projectResponse(params: {
  raw: LlmResponse;
  input: ScoringInput;
  model: string;
  validMessageIds: Set<string>;
}): ScoringOutput {
  const { raw, input, model, validMessageIds } = params;
  const filterIds = (ids: string[]) =>
    ids.filter((id) => validMessageIds.has(id));

  const categoryScores: ScoringCategoryResult[] =
    input.scorecard.categories.map((cat) => {
      const match = raw.categoryScores.find((s) => s.categoryId === cat.id);
      if (!match) {
        throw new Error(
          `LLM omitted scoring for category ${cat.id} (${cat.name})`,
        );
      }
      return {
        categoryId: cat.id,
        aiScore: clampToScale(match.score, cat.scaleType),
        aiReasoning: match.reasoning,
        highlightedMessageIds: filterIds(match.highlightedMessageIds),
      };
    });

  const autoFailTriggered =
    raw.autoFailTriggered ||
    categoryScores.some((s) => {
      const cat = input.scorecard.categories.find(
        (c) => c.id === s.categoryId,
      );
      return cat?.isAutofail && s.aiScore === 0;
    });

  const overallScore = computeOverall({
    scorecard: input.scorecard,
    categoryScores,
    autoFailTriggered,
  });

  return {
    overallScore,
    aiModel: model,
    aiConfidence: raw.aiConfidence,
    aiReasoningSummary: raw.aiReasoningSummary,
    autoFailTriggered,
    categoryScores,
    coachingNote: {
      strengthPoints: raw.coachingNote.strengthPoints.slice(0, 3),
      growthPoints: raw.coachingNote.growthPoints.slice(0, 3),
      exampleMessageIds: filterIds(raw.coachingNote.exampleMessageIds),
    },
  };
}

function clampToScale(
  score: number,
  scale: ScoringCategory["scaleType"],
): number {
  const rounded = Math.round(score);
  if (scale === "binary") return rounded <= 0 ? 0 : 1;
  if (scale === "three_state") return Math.max(0, Math.min(2, rounded));
  return Math.max(1, Math.min(5, rounded));
}

function computeOverall(params: {
  scorecard: ScoringInput["scorecard"];
  categoryScores: ScoringCategoryResult[];
  autoFailTriggered: boolean;
}): number {
  if (params.autoFailTriggered) return params.scorecard.autoFailFloor;
  // SVP-228: weight summation is criterion-level. AI scores arrive per
  // category; every criterion inside a category inherits its projected score
  // and contributes its own weight. Mirrors `mock-provider.computeOverallScore`
  // — see that function for the rationale.
  let weighted = 0;
  let weightSum = 0;
  for (const category of params.scorecard.categories) {
    if (category.isAutofail) continue;
    const result = params.categoryScores.find(
      (s) => s.categoryId === category.id,
    );
    if (!result) continue;
    const projected =
      category.scaleType === "likert_5"
        ? ((result.aiScore - 1) / 4) * 100
        : category.scaleType === "three_state"
          ? (result.aiScore / 2) * 100
          : result.aiScore * 100;
    for (const criterion of category.criteria) {
      weighted += projected * criterion.weightPercent;
      weightSum += criterion.weightPercent;
    }
  }
  if (weightSum === 0) return 0;
  return Math.round(weighted / weightSum);
}
