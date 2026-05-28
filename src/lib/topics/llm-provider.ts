/**
 * Real LLM topic-attachment provider. Issues one structured-output call to the
 * configured model with the response's comment + answer text + the closed
 * topic taxonomy, gets back a list of `{ topic, sentiment }` tags, validates
 * with zod, and returns the rolled-up response-level topics.
 *
 * Model-agnostic at the public surface — the model identifier is injected
 * via env (see `index.ts`). Today's implementation uses the Anthropic SDK;
 * swapping providers is an internal detail.
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import type { SurveyAnswer, TopicTag } from "@/db/schema";
import { TOPICS, TOPIC_BY_ID, rollupTopics } from "./taxonomy";
import type {
  TopicAttachmentInput,
  TopicAttachmentOutput,
  TopicProvider,
} from "./types";

const llmResponseSchema = z.object({
  topics: z.array(
    z.object({
      topic: z.string(),
      sentiment: z.enum(["positive", "neutral", "negative"]),
    }),
  ),
});

export class LlmTopicProvider implements TopicProvider {
  readonly name: string;
  private client: Anthropic;
  private model: string;

  constructor(opts: { apiKey: string; model: string }) {
    this.client = new Anthropic({ apiKey: opts.apiKey });
    this.model = opts.model;
    this.name = opts.model;
  }

  async attachTopics(
    input: TopicAttachmentInput,
  ): Promise<TopicAttachmentOutput> {
    const started = Date.now();
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(input);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: systemPrompt,
      tools: [
        {
          name: "record_topics",
          description:
            "Record the topics this survey response touches on, with a per-topic sentiment.",
          input_schema: buildToolSchema(),
        },
      ],
      tool_choice: { type: "tool", name: "record_topics" },
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
        `LLM topic response failed schema validation: ${parsed.error.message}`,
      );
    }

    // Drop any topic ids the model invented (defensive — the enum constraint
    // in the tool schema is the first line of defense; this is the seatbelt).
    const validTags: TopicTag[] = parsed.data.topics
      .filter((t) => TOPIC_BY_ID[t.topic])
      .map((t) => ({ topic: t.topic, sentiment: t.sentiment }));

    const topics = rollupTopics([validTags]);

    console.log(
      `[llm-topics] model=${this.model} response=${input.responseId} ` +
        `tokens_in=${response.usage.input_tokens} ` +
        `tokens_out=${response.usage.output_tokens} ` +
        `topics=${topics.length}`,
    );

    return {
      topics,
      provider: this.name,
      latencyMs: Date.now() - started,
    };
  }
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function buildSystemPrompt(): string {
  const taxonomyByGroup = new Map<string, string[]>();
  for (const t of TOPICS) {
    const list = taxonomyByGroup.get(t.group) ?? [];
    list.push(`  - ${t.id}: ${t.label}`);
    taxonomyByGroup.set(t.group, list);
  }
  const taxonomyBlock = [...taxonomyByGroup.entries()]
    .map(([group, items]) => `${group}:\n${items.join("\n")}`)
    .join("\n\n");

  return [
    "You are classifying a customer survey response against a closed topic taxonomy.",
    "You must call the record_topics tool exactly once.",
    "",
    "Rules:",
    "- Only use `topic` ids from the taxonomy below. Never invent ids.",
    "- Return at most 4 topics. Prefer the most specific match; do not add tangentially-related topics.",
    "- If the response is empty / generic praise / generic complaint with no specific subject, return an empty array.",
    "- Sentiment is the customer's feeling about that topic in this response: `positive` (happy / praising), `neutral` (factual / unclear), or `negative` (complaining / dissatisfied).",
    "",
    "Topic taxonomy:",
    "",
    taxonomyBlock,
  ].join("\n");
}

function buildUserPrompt(input: TopicAttachmentInput): string {
  const lines: string[] = [
    `Response id: ${input.responseId}`,
    `Rating: ${input.rating} / ${input.scale}`,
  ];
  if (input.comment) {
    lines.push("", "Top-level comment:", input.comment);
  }
  const answerBlock = formatAnswers(input.answers);
  if (answerBlock) {
    lines.push("", "Survey answers:", answerBlock);
  }
  if (!input.comment && !answerBlock) {
    lines.push("", "(No free-text content — return an empty topics array.)");
  }
  return lines.join("\n");
}

function formatAnswers(answers: SurveyAnswer[]): string {
  const out: string[] = [];
  for (const a of answers) {
    switch (a.type) {
      case "rating":
        out.push(`Q: ${a.question}\nA: ${a.value} / ${a.scale}`);
        break;
      case "multi-choice":
        out.push(`Q: ${a.question}\nA: ${a.value}`);
        break;
      case "multi-select":
        out.push(`Q: ${a.question}\nA: ${a.value.join(", ") || "(none)"}`);
        break;
      case "comment":
        if (a.value.trim().length > 0) {
          out.push(`Q: ${a.question}\nA: ${a.value}`);
        }
        break;
    }
  }
  return out.join("\n\n");
}

function buildToolSchema() {
  const topicIdEnum = TOPICS.map((t) => t.id);
  return {
    type: "object" as const,
    properties: {
      topics: {
        type: "array",
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            topic: { type: "string", enum: topicIdEnum },
            sentiment: {
              type: "string",
              enum: ["positive", "neutral", "negative"],
            },
          },
          required: ["topic", "sentiment"],
        },
      },
    },
    required: ["topics"],
  };
}
