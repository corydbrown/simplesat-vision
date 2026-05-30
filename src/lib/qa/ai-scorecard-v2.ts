import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db/client";
import {
  assertCodeDefinedScorecardWeights,
  installCodeDefinedScorecard,
  type CodeDefinedScorecard,
  type InstalledScorecard,
} from "@/lib/qa/scorecard-spec";

/**
 * AI Scorecard v2 — the wedge rubric. Replaces the Phase 2b IQS-clone
 * (`ai-quality-scorecard.ts`) with an AI-native rubric whose thesis is
 * "Either solve it or get out of the way." Phase 2b's scorecard stays on
 * Pronto as-is; this rubric installs alongside on Simplesat where Sim
 * (Intercom Fin) is in production.
 *
 * Six independent criteria, each its own category so the LLM scores them
 * separately and the Bullshit Detector can read three specific category
 * scores at query time without parsing JSON or denormalising.
 *
 * The Bullshit Detector (derived) trips when criteria 1, 2, and 5 ALL
 * score ≤ 2 on the same evaluation — the "trying-trying-trying" pattern
 * the manifesto names. See [bullshit-detector.ts](./bullshit-detector.ts).
 */
export const AI_SCORECARD_V2_NAME = "AI Scorecard v2";

export const AI_SCORECARD_V2_CRITERIA = {
  answerDirectness: "Answer directness",
  recognitionOfLimits: "Recognition of limits",
  noTheater: "No theater",
  accuracy: "Accuracy",
  customerTimeRespect: "Customer time respect",
  nonCuriosity: "Non-curiosity",
} as const;

/** The three criteria whose simultaneous failure (effective score ≤ 2) trips
 *  the Bullshit Detector. Named here so the detector query and the scorecard
 *  spec share one source of truth — rename a category, the detector follows. */
export const BULLSHIT_DETECTOR_CRITERIA = [
  AI_SCORECARD_V2_CRITERIA.answerDirectness,
  AI_SCORECARD_V2_CRITERIA.recognitionOfLimits,
  AI_SCORECARD_V2_CRITERIA.customerTimeRespect,
] as const;

/** Effective-score threshold for a criterion to count as "failing" toward
 *  the Bullshit Detector. ≤ this value = Fail / Poor band on the 1-5 scale. */
export const BULLSHIT_DETECTOR_FAIL_AT_OR_BELOW = 2;

export const AI_SCORECARD_V2: CodeDefinedScorecard = {
  name: AI_SCORECARD_V2_NAME,
  enabled: true,
  version: 1,
  appliesTo: "ai",
  autoFailFloor: 30,
  scoringPhilosophy:
    "Score the AI agent against one standard: either it solved the customer's problem cleanly, or it got out of the way for someone who could. Trained-voice pleasantries do not earn points. Confident wrong answers lose points faster than honest admissions of limit. Reward turns that the customer would describe as fast and useful; penalise turns that felt like talking to a chatbot. Treat every criterion independently — a clean answer on one topic does not excuse name-drop theater on another. Default to the band that best describes the AI's contribution overall, but do not average away an egregious moment.",
  bandDescriptors: [
    "Bullshit — fakes competence, wastes the customer's time, never recognises its limits. The pattern the wedge exists to expose.",
    "Poor — significant theater, hallucination, or failure to hand off. Coaches a human teammate would receive in writing.",
    "Adequate — answer landed eventually, but with friction. The AI did not actively harm the interaction.",
    "Solid — direct, accurate, knew when to step aside. The bar an AI agent should clear by default.",
    "Exceptional — fast, accurate, no ceremony, anticipated the underlying need. The kind of turn we would screenshot for calibration.",
  ],
  domainContext:
    "Customer-support tickets handled by an AI agent (Intercom Fin, branded 'Sim' to Simplesat customers) on a B2B SaaS product. Tickets range from simple how-tos to integration debugging, billing, and Enterprise launch escalations. The AI agent has access to KB articles and prior ticket context. Plan tier, time pressure, and account size matter — an Enterprise customer with 'launch tmrw' is a routing signal the AI should respect.",
  toneExpectations:
    "Direct, businesslike, conversational without AI-customer-service tells. No 'Hi {{name}}!' openings, no name-drop every turn, no 'Great question!' / 'I'd be happy to help' / 'I understand your frustration', no auto-pokes ('Did that answer your question?' / 'Is that what you were looking for?') between customer turns. When the AI does not know, it should say so plainly. When it does know, it should answer in the fewest turns the customer can act on.",
  categories: [
    {
      name: AI_SCORECARD_V2_CRITERIA.answerDirectness,
      description:
        "Did the first turn deliver the answer, or bury it under preamble? Theater openings ('Hi John, I'd be happy to help'), restating the question, name-dropping, and pleasantry-padding all push this toward Fail.",
      weightPercent: 17,
      scaleType: "likert_5",
      isAutofail: false,
      criteria: [
        {
          text: "Did the AI deliver the answer directly in the first turn, with no ceremony?",
          anchor5:
            "Answer + the one obvious next step, zero ceremony. Customer could act on it without re-reading.",
          anchor3:
            "First turn delivered the answer with minimal preamble; some unnecessary padding but the answer was findable.",
          anchor1:
            "Buried answer under pleasantries, name-dropping, restating the question, or 'I'd be happy to help'-style preamble. Customer had to dig for the actual answer.",
          weightPercent: 17,
        },
      ],
    },
    {
      name: AI_SCORECARD_V2_CRITERIA.recognitionOfLimits,
      description:
        "When the AI cannot solve the problem, does it admit it and hand off, or keep trying with vague suggestions and fabrications? The AI that fakes competence is worse than the AI that admits 'I don't know.'",
      weightPercent: 17,
      scaleType: "likert_5",
      isAutofail: false,
      criteria: [
        {
          text: "Did the AI recognise when it couldn't help and hand off cleanly?",
          anchor5:
            "Detected the limit on turn 1 and handed off with full context for the human — no wasted customer turns.",
          anchor3:
            "Within ~2 turns admitted 'I can't help with this' and handed off. Some friction but ended in the right place.",
          anchor1:
            "Kept trying after failed attempts; fabricated or pivoted to vague suggestions; never handed off, or only handed off after the customer asked for a human directly.",
          weightPercent: 17,
        },
      ],
    },
    {
      name: AI_SCORECARD_V2_CRITERIA.noTheater,
      description:
        "Is the AI talking like a teammate or performing the trained chatbot voice? Hollow empathy, 'Great question!', emoji theater, dropping the customer's name (or worse, company name) every turn — these are tells that erode trust faster than wrong answers do.",
      weightPercent: 17,
      scaleType: "likert_5",
      isAutofail: false,
      criteria: [
        {
          text: "Did the AI avoid trained-voice theater — no name-dropping every turn, no hollow empathy, no AI-customer-service tells?",
          anchor5:
            "Conversational without any AI-customer-service tells. Sounds like a teammate, not a chatbot.",
          anchor3:
            "Businesslike, customer's name used at most once, no manufactured warmth. Some minor tells but nothing distracting.",
          anchor1:
            "Heavy name-dropping ('Hi John', 'John, John...'), hollow empathy ('I understand your frustration'), 'Great question!', mid-turn auto-pokes ('Did that answer your question?'), or treating a company name as a first name. Theater is louder than the substance.",
          weightPercent: 17,
        },
      ],
    },
    {
      name: AI_SCORECARD_V2_CRITERIA.accuracy,
      description:
        "Is every claim grounded? Citing a real KB article does not redeem an answer pulled from the wrong context — keyword retrieval without understanding is still hallucination. Confident wrong answers lose more trust than honest admissions.",
      weightPercent: 17,
      scaleType: "likert_5",
      isAutofail: false,
      criteria: [
        {
          text: "Were the AI's claims accurate and grounded in the right context?",
          anchor5:
            "Accurate, grounded, cites the right source. No fabricated specifics, no out-of-context KB pulls.",
          anchor3:
            "Accurate within scope. Minor imprecision or generic phrasing but nothing wrong.",
          anchor1:
            "Fabricated an answer, asserted unsupported claims, or cited a source that does not actually support the claim made. Bot is doing keyword retrieval, not understanding.",
          weightPercent: 17,
        },
      ],
    },
    {
      name: AI_SCORECARD_V2_CRITERIA.customerTimeRespect,
      description:
        "Concise turns, direct path. Walls of generic troubleshooting at customers who said 'ASAP', extraction loops, and auto-pokes between turns all signal disrespect for the customer's time. 'Would the customer call this fast?' is the test.",
      weightPercent: 16,
      scaleType: "likert_5",
      isAutofail: false,
      criteria: [
        {
          text: "Did the AI respect the customer's time — concise turns, direct path, no walls or loops?",
          anchor5:
            "Customer would describe the interaction as fast. Minimum turns, no padding, no auto-pokes.",
          anchor3:
            "Reasonable turn count and length. Some friction but resolution was direct.",
          anchor1:
            "Walls of generic troubleshooting, multi-turn extraction to get to the actual answer, repeated rewordings of the same advice, or auto-pokes between every customer turn.",
          weightPercent: 16,
        },
      ],
    },
    {
      name: AI_SCORECARD_V2_CRITERIA.nonCuriosity,
      description:
        "When the question has a likely deeper need, does the AI ask, or does it answer the literal surface question? A human would ask 'why?' or 'what platform are you on?' before launching into specific guidance. The bot that takes every question at face value misses the real problem.",
      weightPercent: 16,
      scaleType: "likert_5",
      isAutofail: false,
      criteria: [
        {
          text: "Did the AI interrogate the premise when a human would — asking the missing 'why', the missing platform, the underlying need?",
          anchor5:
            "Actively probed the why and surfaced an underlying need the customer hadn't articulated. The kind of clarification a senior human would have asked.",
          anchor3:
            "Asked at least one clarifying question of substance before committing to a specific answer path.",
          anchor1:
            "Answered the literal question without checking for a deeper need, OR launched into platform-specific / tool-specific guidance without asking what platform the customer uses. Confident on the surface, missed the actual problem.",
          weightPercent: 16,
        },
      ],
    },
  ],
};

assertCodeDefinedScorecardWeights(AI_SCORECARD_V2, "AI_SCORECARD_V2");

export type InstallAiScorecardV2Result =
  | { skipped: true; scorecardId: string }
  | ({ skipped: false } & InstalledScorecard);

/** Idempotent install — mirrors `installAiQualityScorecard`. If a scorecard
 *  with the same name already exists in the workspace (and isn't archived),
 *  return its id and skip. Otherwise hydrate the full v2 rubric. */
export async function installAiScorecardV2(
  workspaceId: string,
  options: { createdAt?: Date } = {},
): Promise<InstallAiScorecardV2Result> {
  const [existing] = await db
    .select({ id: schema.scorecards.id })
    .from(schema.scorecards)
    .where(
      and(
        eq(schema.scorecards.workspaceId, workspaceId),
        eq(schema.scorecards.name, AI_SCORECARD_V2.name),
        isNull(schema.scorecards.archivedAt),
      ),
    )
    .limit(1);
  if (existing) {
    return { skipped: true, scorecardId: existing.id };
  }

  const installed = await installCodeDefinedScorecard(
    workspaceId,
    AI_SCORECARD_V2,
    options,
  );
  return { skipped: false, ...installed };
}
