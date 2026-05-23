/**
 * The default QA scorecard, defined in code per CLAUDE.md → Don't do
 * ("Don't add a `property_definitions` DB table for custom attributes" — same
 * principle: keep tunable demo content in code). Hand-tunable for narrative,
 * hydrated into the `scorecards` + `scorecard_categories` + `scorecard_criteria`
 * tables at seed time.
 *
 * Five categories per PRD Part 7. Weights for the four scored categories
 * sum to 100; Compliance & Safety carries weight 0 and forces overall to a
 * floor when any auto-fail criterion fails. Per PRD D-9, the framework is in
 * place but the auto-fail items are disabled by default in production — for
 * the demo we surface them so the seam is visible end-to-end.
 *
 * Anchor text is lifted directly from PRD Part 7 — keep edits here in sync
 * with the source doc when the PRD updates.
 */

import type { ScorecardScaleType } from "@/db/schema";

export type DefaultScorecardCriterion = {
  text: string;
  anchor5: string;
  anchor3: string;
  anchor1: string;
};

export type DefaultScorecardCategory = {
  name: string;
  description: string;
  weightPercent: number;
  scaleType: ScorecardScaleType;
  isAutofail: boolean;
  criteria: DefaultScorecardCriterion[];
};

export type DefaultScorecard = {
  name: string;
  isDefault: true;
  enabled: true;
  version: number;
  /** Auto-fail floor: when any binary auto-fail criterion fails, the
   *  evaluation's overall score is clamped to this value. PRD default: 30. */
  autoFailFloor: number;
  categories: DefaultScorecardCategory[];
};

export const DEFAULT_SCORECARD: DefaultScorecard = {
  name: "Default scorecard",
  isDefault: true,
  enabled: true,
  version: 1,
  autoFailFloor: 30,
  categories: [
    {
      name: "Customer Connection",
      description:
        "Did the agent demonstrate genuine understanding of the customer's situation and emotional state? Did they personalize the interaction?\n\nCriteria:\n- Acknowledged the customer's specific issue, not a generic \"sorry for the inconvenience\"\n- Demonstrated understanding by paraphrasing or restating the problem\n- Used the customer's name and any relevant prior context\n- Matched the appropriate tone for the customer's emotional state (calm if neutral, more empathetic if frustrated)\n- Avoided robotic / templated phrasing where personalization was possible",
      weightPercent: 35,
      scaleType: "likert_5",
      isAutofail: false,
      criteria: [
        {
          text: "Did the agent demonstrate genuine understanding of the customer's situation and personalize the interaction?",
          anchor5:
            "Agent clearly understood the customer's situation, paraphrased the issue to confirm understanding, acknowledged any emotional weight, and made the customer feel heard throughout.",
          anchor3:
            "Agent addressed the issue politely but did not explicitly acknowledge customer's situation or emotional state. Felt transactional but not cold.",
          anchor1:
            "Agent ignored or dismissed the customer's emotional state, used generic templated language, or made the customer feel like a number.",
        },
      ],
    },
    {
      name: "Resolution Quality",
      description:
        "Did the agent solve the right problem, completely and accurately?\n\nCriteria:\n- Provided the correct answer or correct path to resolution\n- Addressed all the customer's questions, not just the first\n- Offered proactive next steps or related guidance\n- Confirmed resolution before closing\n- Did not require the customer to follow up due to incomplete resolution",
      weightPercent: 30,
      scaleType: "likert_5",
      isAutofail: false,
      criteria: [
        {
          text: "Did the agent solve the right problem, completely and accurately?",
          anchor5:
            "Issue fully resolved in this conversation, all questions answered, proactive next steps offered, customer confirmed resolution.",
          anchor3:
            "Issue addressed but some loose ends. Customer may or may not need to come back.",
          anchor1:
            "Wrong answer, partial answer, or customer would clearly need to follow up.",
        },
      ],
    },
    {
      name: "Communication",
      description:
        "Was the response clear, well-written, and on-brand?\n\nCriteria:\n- Clear and easy to understand\n- Appropriate level of detail (not too terse, not overwhelming)\n- Free of significant grammar or spelling errors\n- Consistent with brand voice (configurable per account; default: friendly and professional)\n- Avoided jargon, or explained it when used",
      weightPercent: 15,
      scaleType: "likert_5",
      isAutofail: false,
      criteria: [
        {
          text: "Was the response clear, well-written, and on-brand?",
          anchor5: "Crisp, clear, on-brand, no errors, well-structured.",
          anchor3:
            "Understandable but rough edges — minor errors, awkward phrasing, or inconsistent voice.",
          anchor1:
            "Hard to understand, significant errors, off-brand, or confusing structure.",
        },
      ],
    },
    {
      name: "Process & Ownership",
      description:
        "Did the agent take ownership of the ticket through resolution? Did they follow process correctly, or did the ticket bounce around unnecessarily?\n\nCriteria:\n- Took ownership of the ticket through resolution (no unnecessary transfers)\n- Reassignments, when they happened, were justified (specialist escalation, not avoidance)\n- Used appropriate tags, macros, and templates\n- Escalated cleanly when needed, with full context handoff\n- Left useful internal notes when handing off or pausing\n- Closed the ticket in the correct status with appropriate documentation\n\nThis category bakes the ticket-event differentiator into the rubric itself (PRD Part 8) — reassignment counts, time-in-queue, and SLA signals factor into the score.",
      weightPercent: 20,
      scaleType: "likert_5",
      isAutofail: false,
      criteria: [
        {
          text: "Did the agent own the ticket through resolution and follow process correctly?",
          anchor5:
            "Agent owned the ticket end-to-end. Any handoffs were warranted and clean. Process followed throughout.",
          anchor3:
            "Ticket resolved but with some process friction — unnecessary transfer, missing tag, or incomplete handoff.",
          anchor1:
            "Ticket bounced between agents, ownership unclear, process violations, or messy closing.",
        },
      ],
    },
    {
      name: "Compliance & Safety",
      description:
        "Did the agent avoid actions that have outsized negative consequences regardless of how well everything else went? Each item is a binary auto-fail — any failure forces the overall score to the configured floor (default 30).",
      weightPercent: 0,
      scaleType: "binary",
      isAutofail: true,
      criteria: [
        {
          text: "Avoided exposing PII unnecessarily (customer or third-party).",
          anchor5: "",
          anchor3: "",
          anchor1: "",
        },
        {
          text: "Did not abandon the customer without resolution and no follow-up scheduled.",
          anchor5: "",
          anchor3: "",
          anchor1: "",
        },
        {
          text: "Did not disclose information that should not be disclosed (account access without verification, etc.).",
          anchor5: "",
          anchor3: "",
          anchor1: "",
        },
        {
          text: "Used language acceptable in a customer-facing context.",
          anchor5: "",
          anchor3: "",
          anchor1: "",
        },
        {
          text: "Did not promise something the company cannot deliver.",
          anchor5: "",
          anchor3: "",
          anchor1: "",
        },
      ],
    },
  ],
};
