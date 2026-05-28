/**
 * Deterministic mock scoring provider. Uses an isolated Faker instance
 * seeded from a hash of the ticket id, so the same ticket always produces
 * the same score across seed runs and across env (CI, local, prod-demo).
 *
 * Distribution target (per SVP-53 brief):
 *  - ~70% in 70-85 (the broad "good support" band)
 *  - ~15% above 90 (excellent)
 *  - ~10% below 60 (poor but not auto-fail)
 *  - ~5%  auto-fail (compliance violation → overall floored to autoFailFloor)
 *
 * The provider derives per-category likert scores from the target overall
 * (with small variance), picks plausible reasoning text from templated
 * pools, and references real message ids from the parent ticket on each
 * category's highlighted_message_ids. That last bit is the contract the
 * supporting-message highlight UI (SVP-54) depends on.
 */

import { Faker, en } from "@faker-js/faker";
import type {
  ScoringCategoryResult,
  ScoringCoachingNote,
  ScoringInput,
  ScoringOutput,
  ScoringProvider,
} from "./types";

export class MockScoringProvider implements ScoringProvider {
  readonly name = "mock-deterministic-v1";

  async scoreConversation(input: ScoringInput): Promise<ScoringOutput> {
    const faker = new Faker({ locale: [en] });
    faker.seed(hashSeed(input.ticket.id));

    const targetOverall = pickTargetOverall(faker, input.ticket.responseRating);
    const autoFailTriggered = targetOverall.bucket === "autofail";

    const categoryScores: ScoringCategoryResult[] = input.scorecard.categories
      .map((category) => {
        const messageIds = pickHighlightedMessages(faker, input);
        if (category.scaleType === "binary") {
          const failed = decideBinaryFail(faker, {
            autoFailTriggered,
            categoryCount: input.scorecard.categories.length,
            criteriaCount: category.criteria.length,
          });
          return {
            categoryId: category.id,
            aiScore: failed ? 0 : 1,
            aiReasoning: buildBinaryReasoning(faker, failed),
            highlightedMessageIds: failed ? messageIds.slice(0, 1) : [],
          };
        }
        const aiScore = likertForTarget(faker, targetOverall.center);
        return {
          categoryId: category.id,
          aiScore,
          aiReasoning: buildLikertReasoning(faker, aiScore),
          highlightedMessageIds: messageIds,
        };
      });

    const overallScore = computeOverallScore({
      scorecard: input.scorecard,
      categoryScores,
      autoFailTriggered,
    });
    const aiConfidence = faker.number.float({ min: 0.68, max: 0.94, fractionDigits: 2 });

    return {
      overallScore,
      aiModel: this.name,
      // Provider identity is "mock" — kept distinct from a real vendor so
      // reports can filter mock-scored evaluations out of cost rollups.
      aiProvider: "mock",
      // Mock provider doesn't consume tokens; surface null so cost-by-model
      // rollups stay honest. Cost is computed downstream only when tokens
      // are populated.
      inputTokens: null,
      outputTokens: null,
      aiConfidence,
      aiReasoningSummary: buildSummaryReasoning(
        faker,
        overallScore,
        autoFailTriggered,
      ),
      autoFailTriggered,
      categoryScores,
      coachingNote: buildCoachingNote(faker, input, categoryScores),
    };
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** FNV-1a-style string hash. Stable across runs and platforms — same input
 *  always produces the same seed. */
function hashSeed(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash || 1;
}

type OverallBucket = "excellent" | "good" | "poor" | "autofail";
type OverallTarget = { bucket: OverallBucket; center: number };

function pickTargetOverall(
  faker: Faker,
  responseRating: number | null,
): OverallTarget {
  const roll = faker.number.int({ min: 0, max: 99 });
  const bucket = pickBucket(roll, responseRating);
  return { bucket, center: centerForBucket(faker, bucket) };
}

/** Bucket selection conditioned on CSAT. Tickets that earned a high rating
 *  skew toward excellent/good QA scores; low-rated tickets skew toward poor
 *  and auto-fail. Null (no response) keeps the original unconditioned
 *  distribution — the slope target only applies to tickets with CSAT. */
function pickBucket(roll: number, responseRating: number | null): OverallBucket {
  if (responseRating === 5) {
    if (roll < 80) return "excellent";
    return "good";
  }
  if (responseRating === 4) {
    if (roll < 70) return "good";
    if (roll < 90) return "excellent";
    return "poor";
  }
  if (responseRating === 3) {
    if (roll < 60) return "good";
    if (roll < 90) return "poor";
    return "excellent";
  }
  if (responseRating === 2 || responseRating === 1) {
    if (roll < 60) return "poor";
    if (roll < 85) return "autofail";
    return "good";
  }
  // No response — fall back to the original distribution.
  if (roll < 70) return "good";
  if (roll < 85) return "excellent";
  if (roll < 95) return "poor";
  return "autofail";
}

function centerForBucket(faker: Faker, bucket: OverallBucket): number {
  switch (bucket) {
    case "good":
      return faker.number.int({ min: 72, max: 85 });
    case "excellent":
      return faker.number.int({ min: 90, max: 97 });
    case "poor":
      return faker.number.int({ min: 45, max: 62 });
    case "autofail":
      return 30;
  }
}

function likertForTarget(faker: Faker, center0to100: number): number {
  // Map 0-100 to 1-5 with light per-category jitter so categories vary.
  const projected = 1 + (center0to100 / 100) * 4;
  const jittered = projected + faker.number.float({ min: -0.4, max: 0.4 });
  return Math.max(1, Math.min(5, Math.round(jittered)));
}

function computeOverallScore(params: {
  scorecard: ScoringInput["scorecard"];
  categoryScores: ScoringCategoryResult[];
  autoFailTriggered: boolean;
}): number {
  if (params.autoFailTriggered) return params.scorecard.autoFailFloor;
  // SVP-228: weight summation is criterion-level. AI scores still arrive
  // per-category (likert), so every criterion inside a category inherits the
  // same projected score and contributes its own weight. For the legacy IQS
  // rubric (1 weighted criterion per non-autofail category, criterion weight
  // = category weight after backfill) this is byte-equivalent to the old
  // category-level formula. Once Aprikot lands (SVP-230) with multiple
  // weighted criteria per category, this expression naturally generalises.
  let weighted = 0;
  let weightSum = 0;
  for (const category of params.scorecard.categories) {
    if (category.isAutofail) continue;
    const result = params.categoryScores.find(
      (s) => s.categoryId === category.id,
    );
    if (!result) continue;
    // For likert_5: project 1-5 onto 0-100 (1 → 0, 5 → 100).
    const projected = ((result.aiScore - 1) / 4) * 100;
    for (const criterion of category.criteria) {
      weighted += projected * criterion.weightPercent;
      weightSum += criterion.weightPercent;
    }
  }
  if (weightSum === 0) return 0;
  return Math.round(weighted / weightSum);
}

function pickHighlightedMessages(faker: Faker, input: ScoringInput): string[] {
  // Prefer agent messages — the rubric scores agent behavior. Fall back to
  // customer or system messages if needed so we always return at least one
  // id. Cap at 3 (keeps the supporting-message UI legible).
  const agentMessages = input.messages.filter((m) => m.authorRole === "agent");
  const pool = agentMessages.length > 0 ? agentMessages : input.messages;
  if (pool.length === 0) return [];
  const count = Math.min(
    pool.length,
    faker.number.int({ min: 1, max: 3 }),
  );
  return faker.helpers.arrayElements(
    pool.map((m) => m.id),
    count,
  );
}

const LIKERT_REASONING_BY_SCORE: Record<number, string[]> = {
  5: [
    "Agent acknowledged the customer's specific situation upfront and confirmed understanding before proposing a fix. Tone matched the customer's energy.",
    "Excellent end-to-end ownership — agent paraphrased the issue, walked through the resolution clearly, and confirmed satisfaction at close.",
    "Crisp, on-brand response. Clear structure, no errors, and the agent volunteered relevant next steps without prompting.",
    "Resolution complete in one pass. Agent answered every question the customer raised and offered a proactive follow-up.",
  ],
  4: [
    "Strong handling overall — agent acknowledged the issue and resolved it cleanly, with one or two missed micro-empathy moments.",
    "Solid work. Resolution was on-target; communication was clear if slightly templated in places.",
    "Agent owned the ticket through to close. Minor process friction (a missed tag) but nothing that affected the customer.",
  ],
  3: [
    "Adequate. The issue got addressed but the agent kept it transactional — no real personalization, no acknowledgment of frustration.",
    "Resolution was correct but left loose ends. Customer may or may not come back depending on whether the follow-up was actioned.",
    "Communication was understandable but rough — minor errors and awkward phrasing in the longer reply.",
    "Process was followed but not cleanly. Reassignment happened mid-thread without a handoff note.",
  ],
  2: [
    "Customer flagged frustration explicitly and the agent moved past it without acknowledgment. Tone mismatch throughout.",
    "Partial resolution. The agent answered the first question but the customer's follow-up went unaddressed in the close.",
    "Response was hard to parse — long block of text, jargon used without explanation, and unclear next step.",
    "Ticket bounced between two agents with no handoff note. Customer had to re-explain context twice.",
  ],
  1: [
    "Dismissive tone. Customer raised an emotional concern; agent responded with a templated apology and moved on.",
    "Wrong answer to the customer's core question. The closing message contradicts the policy stated mid-thread.",
    "Confusing structure, multiple grammar errors, off-brand voice. Customer would need to re-read to understand.",
    "Messy ownership — three reassignments, no notes, ticket closed without confirmation.",
  ],
};

function buildLikertReasoning(faker: Faker, score: number): string {
  // SVP-77: reasoning text is reference-free. Supporting message ids live on
  // `highlightedMessageIds` (structured field) — the UI renders them as a
  // chip-row, no regex over reasoning text.
  const pool = LIKERT_REASONING_BY_SCORE[score] ?? LIKERT_REASONING_BY_SCORE[3];
  return faker.helpers.arrayElement(pool);
}

const BINARY_PASS_REASONS = [
  "No compliance issues observed in this conversation.",
  "Agent handled sensitive information appropriately and verified identity before disclosure.",
  "Language stayed customer-appropriate; no PII exposed unnecessarily.",
];

const BINARY_FAIL_REASONS = [
  "Agent disclosed account-level information without completing identity verification.",
  "Customer's full payment card last-4 was repeated in a customer-facing reply.",
  "Agent promised a refund timeline the policy does not support.",
  "Conversation closed with the customer's question unanswered and no follow-up scheduled.",
];

function buildBinaryReasoning(faker: Faker, failed: boolean): string {
  const pool = failed ? BINARY_FAIL_REASONS : BINARY_PASS_REASONS;
  return faker.helpers.arrayElement(pool);
}

/** Decide whether a binary category fails. Only ever true on auto-fail
 *  tickets; even then, only some binary categories fail (probability scales
 *  with criteria density so categories with more criteria are more likely
 *  to be the one that tripped). Keeps the previous behavior, just named. */
function decideBinaryFail(
  faker: Faker,
  params: {
    autoFailTriggered: boolean;
    categoryCount: number;
    criteriaCount: number;
  },
): boolean {
  if (!params.autoFailTriggered) return false;
  const roll = faker.number.int({ min: 0, max: params.categoryCount - 1 });
  return roll < params.criteriaCount;
}

const SUMMARY_TEMPLATES_GOOD = [
  "Strong ticket overall. Agent connected with the customer early, resolved the issue cleanly, and closed with clear next steps.",
  "Solid end-to-end handling. A few small communication tightenings would push this into excellent territory.",
  "Good work across the board — empathy was there, resolution was complete, process was clean.",
];

const SUMMARY_TEMPLATES_EXCELLENT = [
  "Excellent ticket. Genuine connection, complete resolution, on-brand communication, and clean ownership.",
  "Model conversation. Use this one for calibration — it lands on every rubric category.",
];

const SUMMARY_TEMPLATES_POOR = [
  "Mixed handling. Resolution mostly landed but the connection and ownership pieces were weak.",
  "Process friction throughout — reassignments without handoff notes and a templated tone the customer noticed.",
  "Below standard. The issue was technically resolved but the customer experience suffered along the way.",
];

const SUMMARY_TEMPLATES_AUTOFAIL = [
  "Auto-fail: compliance issue detected. Overall score floored regardless of other category strengths. Manager review recommended.",
  "Auto-fail triggered. The conversation needs a calibration pass before this score is finalized.",
];

function buildSummaryReasoning(
  faker: Faker,
  overall: number,
  autoFailTriggered: boolean,
): string {
  if (autoFailTriggered)
    return faker.helpers.arrayElement(SUMMARY_TEMPLATES_AUTOFAIL);
  if (overall >= 90)
    return faker.helpers.arrayElement(SUMMARY_TEMPLATES_EXCELLENT);
  if (overall >= 70) return faker.helpers.arrayElement(SUMMARY_TEMPLATES_GOOD);
  return faker.helpers.arrayElement(SUMMARY_TEMPLATES_POOR);
}

const STRENGTH_BANK = [
  "Acknowledged the customer's specific situation early in the thread.",
  "Used the customer's name and referenced their prior order history.",
  "Confirmed resolution before closing the ticket.",
  "Offered a proactive next step the customer didn't have to ask for.",
  "Kept the tone calm and on-brand even when the customer escalated.",
  "Wrote a clean, scannable reply — short paragraphs, clear next action.",
  "Owned the ticket through close without handing it off.",
  "Left a useful internal note that would help the next agent if needed.",
];

const GROWTH_BANK = [
  "Skip the templated apology — start by paraphrasing what the customer is dealing with.",
  "Address every question the customer raises, not just the first.",
  "Confirm resolution before closing — a short \"does this work for you?\" goes a long way.",
  "Tighten the longer reply — break into short paragraphs and lead with the answer.",
  "When reassigning, leave a one-line handoff note so the next agent has context.",
  "Match the customer's tone — when they're frustrated, lean more empathetic in the first reply.",
  "Avoid jargon unless you also explain it in plain language.",
  "Tag the ticket so it slots into the right reporting bucket.",
];

function buildCoachingNote(
  faker: Faker,
  input: ScoringInput,
  categoryScores: ScoringCategoryResult[],
): ScoringCoachingNote {
  const strengthCount = faker.number.int({ min: 1, max: 3 });
  const growthCount = faker.number.int({ min: 1, max: 3 });
  const strengthPoints = faker.helpers.arrayElements(STRENGTH_BANK, strengthCount);
  const growthPoints = faker.helpers.arrayElements(GROWTH_BANK, growthCount);

  // Example messages: collect a couple from across the categories so the
  // coaching note's "see this message" links into real ticket messages.
  const allHighlighted = categoryScores.flatMap((s) => s.highlightedMessageIds);
  const fallbackPool = input.messages
    .filter((m) => m.authorRole === "agent")
    .map((m) => m.id);
  const exampleSource =
    allHighlighted.length > 0 ? allHighlighted : fallbackPool;
  const exampleCount = Math.min(
    exampleSource.length,
    faker.number.int({ min: 1, max: 2 }),
  );
  const exampleMessageIds =
    exampleCount > 0 ? faker.helpers.arrayElements(exampleSource, exampleCount) : [];

  return { strengthPoints, growthPoints, exampleMessageIds };
}
