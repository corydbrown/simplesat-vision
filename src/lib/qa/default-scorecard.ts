/**
 * IQS (Internal Quality Score) — the foundation scorecard, defined in code per
 * CLAUDE.md → Don't do ("Don't add a `property_definitions` DB table for custom
 * attributes" — same principle: keep tunable demo content in code).
 * Hand-tunable for narrative, hydrated into the `scorecards` +
 * `scorecard_categories` + `scorecard_criteria` tables at seed time.
 *
 * Five categories per PRD Part 7. Authoritative weight lives at the criterion
 * level (SVP-228); non-autofail criterion weights sum to 100. Compliance &
 * Safety criteria are binary autofails at weight 0 and force overall to the
 * floor when any of them fail. Categories are pure grouping going forward —
 * their `weightPercent` is still copied here for one release so existing read
 * sites (overall-score recompute, coaching queries, ticket pivot rollups)
 * don't break mid-flight; the column is dropped in a follow-up after SVP-229
 * swaps everything onto the derived `SUM(criterion.weightPercent)`.
 *
 * The four LLM-context fields (`scoringPhilosophy`, `bandDescriptors`,
 * `domainContext`, `toneExpectations`) describe how the rubric should be
 * applied. The mock provider never reads them; the live LLM provider weaves
 * them into its scoring prompt so evaluations match the team's calibration.
 *
 * Anchor text is lifted directly from PRD Part 7 — keep edits here in sync
 * with the source doc when the PRD updates.
 */

import {
  assertCodeDefinedScorecardWeights,
  type CodeDefinedScorecard,
} from "@/lib/qa/scorecard-spec";

export const DEFAULT_SCORECARD: CodeDefinedScorecard = {
  name: "IQS (Internal Quality Score)",
  enabled: true,
  version: 1,
  autoFailFloor: 30,
  scoringPhilosophy:
    "Score the conversation as a coach reviewing a teammate's work, not as a checklist. Reward agents who solve the customer's actual problem with care, even when the script wasn't followed perfectly. Penalise tickets where the customer had to do the work — repeating themselves, chasing for a follow-up, or interpreting a templated reply. Default to the band that best describes the overall handling rather than averaging across moments; one strong recovery can lift a rough opening, and one cold close can sink an otherwise solid thread.",
  bandDescriptors: [
    "Critical failure — would escalate or produce a customer complaint.",
    "Significant problems — clear gaps in expected practice that a manager would coach on directly.",
    "Adequate but mixed — meets the minimum bar, missed opportunities to make the customer feel taken care of.",
    "Solid — meets the standard we expect from every team member on every ticket.",
    "Exceptional — best-in-class handling, the kind of conversation we'd use for calibration.",
  ],
  domainContext:
    "Customer-support tickets from a mid-market B2C retailer. Most issues are orders, returns, loyalty-program questions, and product fit. The customer base is mostly individuals (with a small wholesale tail), so empathy and personalisation land harder than process correctness. Agents have access to order history, prior tickets, and the loyalty record; assume they should reference that context when relevant.",
  toneExpectations:
    "Friendly and human, professional but never stiff. Match the customer's energy: warm and chatty when they're casual, calm and reassuring when they're frustrated, crisp and efficient when they want a quick answer. Avoid corporate hedging (\"unfortunately at this time\"), templated apologies, and unsolicited upsell. First-person plural (\"we\") is fine for policy, but use the agent's own name and \"I\" when taking ownership of an action.",
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
          weightPercent: 35,
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
          weightPercent: 30,
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
          weightPercent: 15,
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
          weightPercent: 20,
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
          text: "Did not promise something the company cannot deliver.",
          anchor5: "",
          anchor3: "",
          anchor1: "",
          weightPercent: 0,
        },
      ],
    },
  ],
};

assertCodeDefinedScorecardWeights(DEFAULT_SCORECARD, "DEFAULT_SCORECARD");
