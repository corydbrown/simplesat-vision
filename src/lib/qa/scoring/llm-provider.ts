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
import { buildSystemPrompt, buildToolSchema, buildUserPrompt } from "./prompt";
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
      provider: "anthropic",
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      validMessageIds,
    });
  }
}

// ---------------------------------------------------------------------------
// Response projection
// ---------------------------------------------------------------------------

function projectResponse(params: {
  raw: LlmResponse;
  input: ScoringInput;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  validMessageIds: Set<string>;
}): ScoringOutput {
  const { raw, input, model, provider, inputTokens, outputTokens, validMessageIds } = params;
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
    aiProvider: provider,
    inputTokens,
    outputTokens,
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

export function computeOverall(params: {
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
