/** Hardcoded sample data for QA-window mockups. Shape mirrors production
 *  `QaEvaluationView` from `src/db/queries/tickets.ts` so it's familiar, but
 *  this file is the only source — no DB query, no shared/ component imports.
 *  Edit freely if a variation needs different shape; the goal is to remove
 *  the data-prep work from worker briefs, not to enforce a contract. */

export type SampleScale = "likert_5" | "binary" | "three_state";

export type SampleMessage = {
  id: string;
  role: "customer" | "agent" | "system";
  authorName: string;
  body: string;
  createdAt: string; // ISO
};

export type SampleCategory = {
  id: string;
  name: string;
  description: string;
  weightPercent: number;
  scaleType: SampleScale;
  isAutofail: boolean;
  aiScore: number;
  humanScore: number | null;
  humanScoreReason: string | null;
  effectiveScore: number;
  aiReasoning: string;
  /** ids referencing entries in `sampleMessages`. */
  highlightedMessageIds: string[];
};

export type SampleEvaluation = {
  id: string;
  overallScore: number; // 0-100
  aiConfidence: number; // 0-100
  status: "ai_scored" | "edited" | "finalized" | "invalidated";
  scoredAt: string; // ISO
  editedAt: string | null;
  scorer: {
    displayName: string;
    avatarColor: string;
  };
  editor: {
    name: string;
    avatarColor: string;
  } | null;
  categories: SampleCategory[];
  coaching: {
    strengthPoints: string[];
    growthPoints: string[];
    exampleMessageIds: string[];
  };
};

export type SampleTicket = {
  id: string;
  externalId: string;
  subject: string;
  status: "open" | "pending" | "solved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  channel: "email" | "chat" | "phone" | "social";
  createdAt: string;
  solvedAt: string | null;
  customer: { name: string; email: string; tier: "insider" | "gold" | "elite" };
  assignee: { name: string; avatarColor: string; team: string };
  tags: string[];
  messages: SampleMessage[];
  evaluation: SampleEvaluation;
};

const t0 = "2026-05-20T14:02:00Z";
const t1 = "2026-05-20T14:04:30Z";
const t2 = "2026-05-20T14:09:00Z";
const t3 = "2026-05-20T14:11:00Z";
const t4 = "2026-05-20T14:18:00Z";
const t5 = "2026-05-20T14:23:00Z";
const t6 = "2026-05-20T14:27:00Z";
const t7 = "2026-05-20T14:35:00Z";

export const sampleMessages: SampleMessage[] = [
  {
    id: "msg_1",
    role: "customer",
    authorName: "Priya Sharma",
    body: "Hi! I placed an order three days ago (#BB-48721) and the tracking still says 'label created.' I needed this for an event on Saturday. Can you check what's going on?",
    createdAt: t0,
  },
  {
    id: "msg_2",
    role: "agent",
    authorName: "Marisol Tate",
    body: "Hi Priya, thanks for reaching out. Let me pull up your order — one moment.",
    createdAt: t1,
  },
  {
    id: "msg_3",
    role: "agent",
    authorName: "Marisol Tate",
    body: "I see the order. The label was created but the package never scanned in at the carrier. That's a fulfillment issue on our end, not on the carrier's side. I'm so sorry — that's frustrating, especially with an event coming up.",
    createdAt: t2,
  },
  {
    id: "msg_4",
    role: "customer",
    authorName: "Priya Sharma",
    body: "Ugh, okay. The event is Saturday so I really need a plan.",
    createdAt: t3,
  },
  {
    id: "msg_5",
    role: "agent",
    authorName: "Marisol Tate",
    body: "Two options: (1) I can overnight a fresh order to you at no charge and waive the original — you'd have it by Thursday or Friday at the latest. (2) If you'd rather pick something up locally, I can refund the order today and add a $25 store credit. Which works better?",
    createdAt: t4,
  },
  {
    id: "msg_6",
    role: "customer",
    authorName: "Priya Sharma",
    body: "Option 1 please — the overnight reship. Thank you so much for being on top of this!",
    createdAt: t5,
  },
  {
    id: "msg_7",
    role: "agent",
    authorName: "Marisol Tate",
    body: "On it. New order #BB-48996 is placed with overnight shipping — tracking will email you within the hour. I'm also adding a 15% off code (BLOOM-PS-15) for your next order, just for the trouble. Anything else I can help with?",
    createdAt: t6,
  },
  {
    id: "msg_8",
    role: "customer",
    authorName: "Priya Sharma",
    body: "That's perfect, you've been amazing. Have a great rest of your day!",
    createdAt: t7,
  },
];

export const sampleTicket: SampleTicket = {
  id: "tkt_sample_001",
  externalId: "BB-7821",
  subject: "Order #BB-48721 — label created but never shipped, need by Saturday",
  status: "solved",
  priority: "high",
  channel: "email",
  createdAt: t0,
  solvedAt: t7,
  customer: {
    name: "Priya Sharma",
    email: "priya.sharma@gmail.com",
    tier: "gold",
  },
  assignee: {
    name: "Marisol Tate",
    avatarColor: "#7C3AED",
    team: "Front line",
  },
  tags: ["shipping-issue", "event-deadline", "reship"],
  messages: sampleMessages,
  evaluation: {
    id: "eval_sample_001",
    overallScore: 88,
    aiConfidence: 92,
    status: "ai_scored",
    scoredAt: "2026-05-20T15:00:00Z",
    editedAt: null,
    scorer: { displayName: "AI scorer (Claude)", avatarColor: "#4F46E5" },
    editor: null,
    categories: [
      {
        id: "cat_acknowledge",
        name: "Acknowledge & empathize",
        description:
          "Did the agent recognize and validate the customer's frustration before jumping to a solution?",
        weightPercent: 20,
        scaleType: "likert_5",
        isAutofail: false,
        aiScore: 4,
        humanScore: null,
        humanScoreReason: null,
        effectiveScore: 4,
        aiReasoning:
          "Marisol named the issue clearly and apologized in msg_3 (\"so sorry — that's frustrating, especially with an event coming up\"). One step short of a 5 because the apology came after the diagnosis, not before.",
        highlightedMessageIds: ["msg_3"],
      },
      {
        id: "cat_diagnose",
        name: "Diagnose the issue",
        description:
          "Did the agent identify the root cause and explain it to the customer in plain language?",
        weightPercent: 20,
        scaleType: "likert_5",
        isAutofail: false,
        aiScore: 5,
        humanScore: null,
        humanScoreReason: null,
        effectiveScore: 5,
        aiReasoning:
          "Clear root-cause framing in msg_3: separates fulfillment-side failure from carrier-side. No hedging, no blame-shifting.",
        highlightedMessageIds: ["msg_3"],
      },
      {
        id: "cat_options",
        name: "Offer actionable options",
        description:
          "Did the agent present concrete options (not just one path) and let the customer choose?",
        weightPercent: 25,
        scaleType: "likert_5",
        isAutofail: false,
        aiScore: 5,
        humanScore: null,
        humanScoreReason: null,
        effectiveScore: 5,
        aiReasoning:
          "Two clear, concrete options in msg_5 (overnight reship vs. refund + store credit). Tied to customer's stated constraint (Saturday event).",
        highlightedMessageIds: ["msg_5"],
      },
      {
        id: "cat_followthrough",
        name: "Close the loop",
        description:
          "Did the agent confirm next steps, set expectations, and verify the customer was satisfied?",
        weightPercent: 25,
        scaleType: "likert_5",
        isAutofail: false,
        aiScore: 4,
        humanScore: null,
        humanScoreReason: null,
        effectiveScore: 4,
        aiReasoning:
          "Strong close in msg_7 (new order id, tracking commitment, courtesy discount, \"anything else?\"). One short of a 5 because no explicit ETA for the tracking email — \"within the hour\" is good but a wall-clock would be better.",
        highlightedMessageIds: ["msg_7"],
      },
      {
        id: "cat_policy",
        name: "Followed policy",
        description:
          "No policy violations (unauthorized discounts, refunds, promises outside SOP).",
        weightPercent: 10,
        scaleType: "binary",
        isAutofail: true,
        aiScore: 1,
        humanScore: null,
        humanScoreReason: null,
        effectiveScore: 1,
        aiReasoning:
          "Overnight reship + 15% off code are both within standard recovery-offer SOP. No escalations or approvals needed.",
        highlightedMessageIds: ["msg_5", "msg_7"],
      },
    ],
    coaching: {
      strengthPoints: [
        "Diagnosed the root cause without hedging — separated fulfillment-side from carrier-side cleanly.",
        "Offered two real options instead of one path, tied to the customer's stated deadline.",
        "Recovered the relationship with a courtesy discount that didn't require escalation.",
      ],
      growthPoints: [
        "Acknowledge the impact *before* explaining the diagnosis — Priya was anxious about Saturday; lead with the empathy.",
        "Tighten the tracking commitment from \"within the hour\" to a specific time so the customer can plan against it.",
      ],
      exampleMessageIds: ["msg_3", "msg_5", "msg_7"],
    },
  },
};
