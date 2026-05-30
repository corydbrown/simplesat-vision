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
 * Resolution Scorecard v1 — the third leaf of Quality's tri-card eval. Where
 * the AI rubric grades the bot's craft and the Human rubric grades the
 * teammate's, this rubric grades the *outcome*: did the customer actually
 * win? Phase 2a's `applies_to: 'resolution'` enum + fan-out picker fires
 * this once per ticket regardless of actor mix; `scored_team_member_id`
 * lands NULL because no individual owns a Resolution score (per
 * [src/lib/qa/auto-scoring/pick-scorecards.test.ts](./auto-scoring/pick-scorecards.test.ts)).
 *
 * Per Cory's 2026-05-30 reframe: there is no AI–human partnership in
 * support. The actors are sequential and possibly adversarial (AI wants
 * containment, customer wants an answer, human wants to wrap). Resolution
 * measures the *result*, not the actor relationship — which is also why
 * scores never roll up to any individual actor's profile.
 *
 * Five independent criteria, equally weighted. "Right routing" is the
 * wedge-exposure criterion — the only place in the rubric system where
 * "this AI shouldn't have touched this" gets scored — so its anchor
 * language gets extra sharpness, not extra weight.
 */
export const RESOLUTION_SCORECARD_V1_NAME = "Resolution Scorecard v1";

export const RESOLUTION_SCORECARD_V1_CRITERIA = {
  problemActuallySolved: "Problem actually solved",
  customerEffort: "Customer effort",
  rightRouting: "Right routing",
  trustImpact: "Trust impact",
  turnEconomy: "Turn economy",
} as const;

export const RESOLUTION_SCORECARD_V1: CodeDefinedScorecard = {
  name: RESOLUTION_SCORECARD_V1_NAME,
  enabled: true,
  version: 1,
  appliesTo: "resolution",
  // Resolution has no autofail criteria (every category isAutofail=false), so
  // the floor never triggers. Explicit 0 over an inert 30 — signals intent.
  autoFailFloor: 0,
  scoringPhilosophy:
    "Score the customer's outcome, not the actors. The question is one thing: did the customer actually win? A clean answer from the AI does not redeem a customer who had to fight for a human; a heroic recovery from the human does not redeem a customer who left with their trust in the brand dented. The actors are sequential and possibly adversarial — AI wants containment, human wants to wrap, customer wants their answer. Resolution measures the result. Default to the band that best describes whether the customer left this conversation in a place they'd describe as 'handled'; one strong recovery moment cannot lift a ticket that ended with the customer restating the original question, and one ugly back-and-forth cannot sink a ticket whose final turn fully resolved the issue. Score every criterion independently — a clean problem-solve does not redeem turn-economy bloat or a routing failure earlier in the thread.",
  bandDescriptors: [
    "Lost — the customer left worse off than they arrived. Problem unsolved, trust in the brand dented, would not pass a 'would we screenshot this for the team?' test.",
    "Friction — the customer eventually got there, but with avoidable effort: had to repeat themselves, push for a human, or restate the question. Coaching territory for the routing layer, not the actor.",
    "Resolved — the customer's problem was solved with appropriate effort. The conversation neither delighted nor frustrated; it did its job.",
    "Smooth — solved cleanly, routed correctly, minimum viable turns, customer left intact. The bar every ticket should clear.",
    "Exceptional — solved + customer thanks the experience, perfect routing, fewest viable turns, trust in the brand visibly reinforced. The kind of ticket we would screenshot for calibration.",
  ],
  domainContext:
    "Customer-support tickets on a B2B SaaS product (Simplesat). Tickets blend AI agent turns (Intercom Fin, branded 'Sim') and human agent turns, often sequentially. Customers range from solo admins evaluating the product to Enterprise launch escalations with time pressure. The conversation that ends with 'Thanks, this worked' is the win condition; the conversation that ends with the customer writing back 'Still not working' or 'Can I talk to a human?' is the loss condition, regardless of how individual turns were scored.",
  toneExpectations:
    "Resolution does not grade tone — the actor scorecards do. Score the customer's experience of the conversation as a whole: did the conversation feel like one ticket headed somewhere, or a series of disconnected attempts? Tone matters only insofar as it shaped whether the customer felt taken care of by the end; do not double-count craft failures that the AI or Human rubric will already penalise.",
  categories: [
    {
      name: RESOLUTION_SCORECARD_V1_CRITERIA.problemActuallySolved,
      description:
        "Was the customer's actual problem resolved, not just the ticket closed? The signal is the customer's own last turn: silence after an answer is weaker evidence than an explicit 'that worked'. A ticket auto-closed by SLA does not count as solved.",
      weightPercent: 20,
      scaleType: "likert_5",
      isAutofail: false,
      criteria: [
        {
          text: "Was the customer's actual problem resolved (not just 'ticket closed')?",
          anchor5:
            "Problem solved AND the customer signalled satisfaction in-thread ('that worked', 'thanks, all set'). No follow-up needed.",
          anchor3:
            "The problem was solved. Customer engagement ended on a resolved turn, but without explicit confirmation of success.",
          anchor1:
            "Customer's problem remains, OR they wrote back with the same question, OR the ticket closed by timeout while the customer was still asking. Resolution did not happen.",
          weightPercent: 20,
        },
      ],
    },
    {
      name: RESOLUTION_SCORECARD_V1_CRITERIA.customerEffort,
      description:
        "How much work did the customer have to do? Repeats, restatements, 'let me talk to a human' markers, and re-opening the ticket are all friction signals. The bar is low effort, not zero effort — a clarifying question is not friction; making the customer repeat their order number for the third time is.",
      weightPercent: 20,
      scaleType: "likert_5",
      isAutofail: false,
      criteria: [
        {
          text: "Did the customer have to do unreasonable work to reach resolution — repeats, restatements, pushing for a human?",
          anchor5:
            "Customer explicitly thanks the interaction or comments on how easy it was. Zero friction markers, no restatements, no human-request.",
          anchor3:
            "Customer engaged through to resolution without friction markers. Reasonable effort for the question's complexity.",
          anchor1:
            "Customer had to repeat themselves, push for a human, or restate the original question one or more times. The conversation made the customer do work the agents should have done.",
          weightPercent: 20,
        },
      ],
    },
    {
      name: RESOLUTION_SCORECARD_V1_CRITERIA.rightRouting,
      description:
        "Did the actor mix match the problem's complexity? This is the wedge-exposure criterion — the only place in the rubric system where 'this AI shouldn't have touched this' (or 'a human didn't need to be pulled in') gets scored. The failure mode in 2026: AI agents grinding for 5 turns on a problem a human would have wrapped in 1. The reverse failure: a routine FAQ that escalated unnecessarily. Both lose points here.",
      weightPercent: 20,
      scaleType: "likert_5",
      isAutofail: false,
      criteria: [
        {
          text: "Did the actor mix match the problem's complexity — bot when it should, human when it should, with the handoff timed right?",
          anchor5:
            "Bot resolved cleanly when it should have, escalated promptly when it shouldn't have. The handoff (if any) happened at the right moment with full context — no wasted customer turns either side of the transition.",
          anchor3:
            "Actor mix matched the problem's complexity. Any handoff was appropriate even if not perfectly timed.",
          anchor1:
            "AI tried too long when it should have handed off (the 'trying-trying-trying' pattern), OR a simple question escalated to a human unnecessarily. The routing failure cost the customer turns.",
          weightPercent: 20,
        },
      ],
    },
    {
      name: RESOLUTION_SCORECARD_V1_CRITERIA.trustImpact,
      description:
        "Did the customer end this interaction trusting Simplesat (and the brand it represents) more, less, or unchanged? A solved problem is necessary but not sufficient — the customer can leave with their problem fixed and their confidence in the product shaken. Listen for the final-turn temperature: appreciation, neutrality, or frustration.",
      weightPercent: 20,
      scaleType: "likert_5",
      isAutofail: false,
      criteria: [
        {
          text: "Did the customer leave the interaction trusting the brand more, less, or unchanged?",
          anchor5:
            "Customer explicitly expresses appreciation for the experience — names the agent, comments on speed/quality, signals they'd recommend or come back. Trust visibly reinforced.",
          anchor3:
            "Customer treated the interaction as a normal transaction. Trust unchanged in either direction.",
          anchor1:
            "Customer ended the interaction expressing frustration with Simplesat, the brand, the product, or the support experience. Trust visibly dented — the kind of ticket that produces a low NPS or a quiet churn.",
          weightPercent: 20,
        },
      ],
    },
    {
      name: RESOLUTION_SCORECARD_V1_CRITERIA.turnEconomy,
      description:
        "Total turn count vs the minimum viable for the problem at hand. A complex Enterprise integration question reasonably takes more turns than a password reset; score against the appropriate baseline. The failure mode is bloat that the customer noticed, not pedantic minimums.",
      weightPercent: 20,
      scaleType: "likert_5",
      isAutofail: false,
      criteria: [
        {
          text: "Did the conversation reach resolution in the minimum viable turns for the problem's complexity?",
          anchor5:
            "Resolved in the minimum viable turns. The customer could not have shortened this interaction without information missing.",
          anchor3:
            "Appropriate turn count for the problem's complexity. Some padding, but nothing the customer would describe as drawn-out.",
          anchor1:
            "Excessive back-and-forth — more than 2x what this resolution needed. Walls of generic suggestions, repeated rewordings, or extraction loops that the customer would describe as 'pulling teeth'.",
          weightPercent: 20,
        },
      ],
    },
  ],
};

assertCodeDefinedScorecardWeights(
  RESOLUTION_SCORECARD_V1,
  "RESOLUTION_SCORECARD_V1",
);

export type InstallResolutionScorecardV1Result =
  | { skipped: true; scorecardId: string }
  | ({ skipped: false } & InstalledScorecard);

/** Idempotent install — mirrors `installAiScorecardV2`. If a scorecard with
 *  the same name already exists in the workspace (and isn't archived),
 *  return its id and skip. Otherwise hydrate the full v1 rubric. */
export async function installResolutionScorecardV1(
  workspaceId: string,
  options: { createdAt?: Date } = {},
): Promise<InstallResolutionScorecardV1Result> {
  const [existing] = await db
    .select({ id: schema.scorecards.id })
    .from(schema.scorecards)
    .where(
      and(
        eq(schema.scorecards.workspaceId, workspaceId),
        eq(schema.scorecards.name, RESOLUTION_SCORECARD_V1.name),
        isNull(schema.scorecards.archivedAt),
      ),
    )
    .limit(1);
  if (existing) {
    return { skipped: true, scorecardId: existing.id };
  }

  const installed = await installCodeDefinedScorecard(
    workspaceId,
    RESOLUTION_SCORECARD_V1,
    options,
  );
  return { skipped: false, ...installed };
}
