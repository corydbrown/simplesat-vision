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
 * AI Quality (Internal) — the Phase 2b placeholder rubric for `applies_to='ai'`
 * evaluations. Identical structure to IQS so the tri-card UI lights up
 * end-to-end the moment Cory seeds it into a workspace. Phase 3 (Bullshit
 * Detector) replaces this content with an AI-native rubric — the install
 * seam (this file + the pronto script) stays.
 *
 * Why a clone vs. a "share categories with IQS" model: scorecards in this
 * codebase carry their own categories + criteria + version snapshots. Sharing
 * would cross seams the rest of the QA stack assumes don't cross. The Phase
 * 3 rubric will diverge anyway, so a clone is the right shape from day one.
 */
export const AI_QUALITY_SCORECARD: CodeDefinedScorecard = {
  name: "AI Quality (Internal)",
  enabled: true,
  version: 1,
  appliesTo: "ai",
  autoFailFloor: 30,
  scoringPhilosophy:
    "Score the AI agent's turns the way you'd score a teammate's. Reward turns that solve the customer's actual problem with care; penalise turns that paper over a missing answer with confident-sounding text, force the customer to repeat themselves, or close out before the issue is resolved. Default to the band that best describes the overall AI handling rather than averaging across moments — one confident, accurate recovery can lift a rough opening; one hallucinated detail can sink an otherwise solid thread.",
  bandDescriptors: [
    "Critical failure — would escalate or produce a customer complaint if the human agent didn't catch it.",
    "Significant problems — clear gaps a manager would coach on if the AI were a human teammate.",
    "Adequate but mixed — meets the minimum bar, missed opportunities to make the customer feel taken care of.",
    "Solid — meets the standard we'd expect from a human teammate.",
    "Exceptional — best-in-class handling, the kind of AI turn we'd use for calibration.",
  ],
  domainContext:
    "Customer-support tickets from a mid-market B2C retailer. Most issues are orders, returns, loyalty-program questions, and product fit. The AI agent (Fin) handles the first-response tier and any tickets it can resolve end-to-end; a human takes over when it escalates. The AI has access to order history, prior tickets, and the loyalty record; assume it should reference that context when relevant.",
  toneExpectations:
    "Friendly and human, professional but never stiff. Match the customer's energy: warm and chatty when they're casual, calm and reassuring when they're frustrated, crisp and efficient when they want a quick answer. Avoid corporate hedging (\"unfortunately at this time\"), templated apologies, and over-padded responses. The AI should sound like a teammate, not a chatbot.",
  categories: [
    {
      name: "Customer Connection",
      description:
        "Did the AI demonstrate genuine understanding of the customer's situation and emotional state? Did it personalize the interaction?\n\nCriteria:\n- Acknowledged the customer's specific issue, not a generic \"sorry for the inconvenience\"\n- Demonstrated understanding by paraphrasing or restating the problem\n- Used the customer's name and any relevant prior context\n- Matched the appropriate tone for the customer's emotional state\n- Avoided robotic / templated phrasing where personalization was possible",
      weightPercent: 35,
      scaleType: "likert_5",
      isAutofail: false,
      criteria: [
        {
          text: "Did the AI demonstrate genuine understanding of the customer's situation and personalize the interaction?",
          anchor5:
            "AI clearly understood the customer's situation, paraphrased the issue to confirm understanding, acknowledged any emotional weight, and made the customer feel heard throughout.",
          anchor3:
            "AI addressed the issue politely but did not explicitly acknowledge the customer's situation or emotional state. Felt transactional but not cold.",
          anchor1:
            "AI ignored or dismissed the customer's emotional state, used generic templated language, or made the customer feel like a number.",
          weightPercent: 35,
        },
      ],
    },
    {
      name: "Resolution Quality",
      description:
        "Did the AI solve the right problem, completely and accurately?\n\nCriteria:\n- Provided the correct answer or correct path to resolution\n- Addressed all the customer's questions, not just the first\n- Offered proactive next steps or related guidance\n- Confirmed resolution before closing\n- Did not require the customer to follow up due to incomplete resolution",
      weightPercent: 30,
      scaleType: "likert_5",
      isAutofail: false,
      criteria: [
        {
          text: "Did the AI solve the right problem, completely and accurately?",
          anchor5:
            "Issue fully resolved in this conversation, all questions answered, proactive next steps offered, customer confirmed resolution.",
          anchor3:
            "Issue addressed but some loose ends. Customer may or may not need to come back.",
          anchor1:
            "Wrong answer, partial answer, hallucinated detail, or customer would clearly need to follow up.",
          weightPercent: 30,
        },
      ],
    },
    {
      name: "Communication",
      description:
        "Was the response clear, well-written, and on-brand?\n\nCriteria:\n- Clear and easy to understand\n- Appropriate level of detail (not too terse, not overwhelming)\n- Free of significant grammar or spelling errors\n- Consistent with brand voice (default: friendly and professional)\n- Avoided jargon, or explained it when used",
      weightPercent: 15,
      scaleType: "likert_5",
      isAutofail: false,
      criteria: [
        {
          text: "Was the response clear, well-written, and on-brand?",
          anchor5: "Crisp, clear, on-brand, no errors, well-structured.",
          anchor3:
            "Understandable but rough edges — awkward phrasing, over-padded response, or inconsistent voice.",
          anchor1:
            "Hard to understand, off-brand, or confusing structure.",
          weightPercent: 15,
        },
      ],
    },
    {
      name: "Process & Ownership",
      description:
        "Did the AI take the ticket as far as it could before involving a human, and hand off cleanly when it had to?\n\nCriteria:\n- Resolved end-to-end when the issue was within scope\n- Escalated to a human when (and only when) escalation was warranted\n- Handed off with full context (no \"the AI dumped me back to square one\")\n- Used appropriate tags / structured fields\n- Closed the ticket in the correct status with appropriate documentation",
      weightPercent: 20,
      scaleType: "likert_5",
      isAutofail: false,
      criteria: [
        {
          text: "Did the AI take the ticket as far as it could and hand off cleanly when needed?",
          anchor5:
            "AI resolved end-to-end OR escalated with a clean, fully-contextualised handoff. Process followed throughout.",
          anchor3:
            "Ticket moved forward but with process friction — late escalation, partial handoff context, or missing tags.",
          anchor1:
            "AI looped without progress, escalated for things it should have handled, or dropped the customer back to square one.",
          weightPercent: 20,
        },
      ],
    },
    {
      name: "Compliance & Safety",
      description:
        "Did the AI avoid actions that have outsized negative consequences regardless of how well everything else went? Each item is a binary auto-fail — any failure forces the overall score to the configured floor (default 30).",
      weightPercent: 0,
      scaleType: "binary",
      isAutofail: true,
      criteria: [
        {
          text: "Avoided exposing PII unnecessarily (customer or third-party).",
          anchor5: "",
          anchor3: "",
          anchor1: "",
          weightPercent: 0,
        },
        {
          text: "Did not abandon the customer without resolution and no follow-up scheduled.",
          anchor5: "",
          anchor3: "",
          anchor1: "",
          weightPercent: 0,
        },
        {
          text: "Did not disclose information that should not be disclosed (account access without verification, etc.).",
          anchor5: "",
          anchor3: "",
          anchor1: "",
          weightPercent: 0,
        },
        {
          text: "Used language acceptable in a customer-facing context.",
          anchor5: "",
          anchor3: "",
          anchor1: "",
          weightPercent: 0,
        },
        {
          text: "Did not promise or invent something the company cannot deliver (hallucinated policy, pricing, availability).",
          anchor5: "",
          anchor3: "",
          anchor1: "",
          weightPercent: 0,
        },
      ],
    },
  ],
};

assertCodeDefinedScorecardWeights(AI_QUALITY_SCORECARD, "AI_QUALITY_SCORECARD");

export type InstallAiQualityResult =
  | { skipped: true; scorecardId: string }
  | ({ skipped: false } & InstalledScorecard);

/** Idempotent install — mirrors `installAprikotScorecard`. If a scorecard
 *  with the same name already exists in the workspace (and isn't archived),
 *  return its id and skip. Otherwise hydrate the full rubric. */
export async function installAiQualityScorecard(
  workspaceId: string,
  options: { createdAt?: Date } = {},
): Promise<InstallAiQualityResult> {
  const [existing] = await db
    .select({ id: schema.scorecards.id })
    .from(schema.scorecards)
    .where(
      and(
        eq(schema.scorecards.workspaceId, workspaceId),
        eq(schema.scorecards.name, AI_QUALITY_SCORECARD.name),
        isNull(schema.scorecards.archivedAt),
      ),
    )
    .limit(1);
  if (existing) {
    return { skipped: true, scorecardId: existing.id };
  }

  const installed = await installCodeDefinedScorecard(
    workspaceId,
    AI_QUALITY_SCORECARD,
    options,
  );
  return { skipped: false, ...installed };
}
