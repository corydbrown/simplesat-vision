import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { faker } from "@faker-js/faker";
import { db, schema } from "./client";
import { prefixedId, setIdRandomSource } from "../lib/ids";
import {
  CUSTOMER_CUSTOM_FIELDS,
  TEAM_MEMBER_CUSTOM_FIELDS,
  type CustomFieldDef,
} from "../lib/properties/custom-fields";
import { rollupTopics } from "../lib/topics";
import { DEFAULT_SCORECARD } from "../lib/qa/default-scorecard";
import { MockScoringProvider } from "../lib/qa/scoring";
import { SEED_VIEWS } from "../lib/views/seed";
import type { EntityKey } from "../lib/views/types";
import { replaceSavedViews } from "./queries/saved-views";
import type {
  ScoringInput,
  ScoringMessage,
  ScoringScorecard,
} from "../lib/qa/scoring";
import type {
  Channel,
  CustomerTier,
  NewCoachingNote,
  NewCustomer,
  NewEvaluation,
  NewEvaluationCategoryScore,
  NewResponse,
  NewScorecard,
  NewScorecardCategory,
  NewScorecardCriterion,
  NewSurvey,
  NewTeamMember,
  NewTeamMemberGroup,
  NewTicket,
  NewTicketEvent,
  NewTicketMessage,
  SurveyAnswer,
  SurveyChannel,
  SurveyNotSentReason,
  SurveyQuestion,
  SurveyType,
  TicketMessageChannel,
  TicketPriority,
  TicketStatus,
  TopicTag,
} from "./schema";

const CONVERSATION_MOCKUP_TAG = "conversation-mockup";

faker.seed(42);

// Route id generation through the seeded Faker so prefixedId() returns the
// same ids every run. App runtime never calls this and keeps the default
// crypto-based generator.
setIdRandomSource(() => faker.number.float({ min: 0, max: 1 }));

const NOW = Date.now();
const ONE_DAY = 24 * 60 * 60 * 1000;
const HORIZON_DAYS = 365;

type Weighted<T> = { value: T; weight: number };

function pickWeighted<T>(items: Weighted<T>[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = faker.number.float({ min: 0, max: total });
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

function pickFrom<T>(arr: readonly T[]): T {
  return arr[faker.number.int({ min: 0, max: arr.length - 1 })];
}

// ---------------------------------------------------------------------------
// Bloom Beauty narrative constants. Mid-market B2C beauty retailer with a
// three-tier loyalty program (Insider / Gold / Elite). ~95% of customers are
// individual consumers; the remaining ~5% are B2B (wholesale, corporate
// gifting, influencer partnerships) and carry a `company` value plus org-
// rollup fields.
// ---------------------------------------------------------------------------

const TIER_WEIGHTS: Weighted<CustomerTier>[] = [
  { value: "insider", weight: 75 },
  { value: "gold", weight: 20 },
  { value: "elite", weight: 5 },
];

const CHANNEL_WEIGHTS: Weighted<Channel>[] = [
  { value: "email", weight: 55 },
  { value: "chat", weight: 32 },
  { value: "phone", weight: 8 },
  { value: "social", weight: 5 },
];

const STATUS_WEIGHTS: Weighted<TicketStatus>[] = [
  { value: "solved", weight: 60 },
  { value: "closed", weight: 25 },
  { value: "pending", weight: 10 },
  { value: "open", weight: 5 },
];

const PRIORITY_WEIGHTS: Weighted<TicketPriority>[] = [
  { value: "normal", weight: 62 },
  { value: "low", weight: 18 },
  { value: "high", weight: 15 },
  { value: "urgent", weight: 5 },
];

const NOT_SENT_REASONS: Weighted<SurveyNotSentReason>[] = [
  { value: "tag_excluded", weight: 35 },
  { value: "suppression_list", weight: 20 },
  { value: "channel_disabled", weight: 30 },
  { value: "automation_close", weight: 15 },
];

const RATING_WEIGHTS: Weighted<number>[] = [
  { value: 5, weight: 60 },
  { value: 4, weight: 20 },
  { value: 3, weight: 10 },
  { value: 2, weight: 6 },
  { value: 1, weight: 4 },
];

const TEAMS = ["Front line", "Senior", "Specialist"] as const;
const SUPPORT_ROLES = [
  "Beauty Advisor",
  "Senior Beauty Advisor",
  "Returns Specialist",
  "VIP Concierge",
  "Customer Care Lead",
  "Loyalty Specialist",
  "Store Care Coordinator",
];

const REGIONS = ["North America", "EMEA", "APAC", "LATAM"] as const;
const LANGUAGES = ["en", "es", "fr", "de", "pt", "ja", "it"] as const;

const AVATAR_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
];

const TAG_POOL = [
  "shipping",
  "returns",
  "refund",
  "damaged",
  "shade-match",
  "loyalty",
  "bopis",
  "gift-card",
  "app",
  "samples",
  "vip",
  "influencer",
  "wholesale",
  "fragrance",
];

/** B2B / wholesale / influencer accounts that consistently produce detractor
 *  responses — useful for the "company-level dissatisfaction" demo. */
const NAMED_DETRACTOR_COMPANIES = [
  { name: "Atlas Hospitality", domain: "atlashospitality.com" },
  { name: "Pacific Beauty Distributors", domain: "pacbeautydist.com" },
  { name: "Crown Department Stores", domain: "crowndept.com" },
];

/** Wider B2B account pool for the ~5% of customers that aren't individuals.
 *  Mix of wholesale, corporate-gifting, influencer, and partner accounts. */
const B2B_COMPANIES: { name: string; domain: string }[] = [
  ...NAMED_DETRACTOR_COMPANIES,
  { name: "Aurora Hotels Group", domain: "aurorahotels.co" },
  { name: "Coastal Spas & Wellness", domain: "coastalspas.com" },
  { name: "Modern Mercantile", domain: "modernmerc.co" },
  { name: "Highland Apothecary Co", domain: "highlandapoth.co" },
  { name: "Marquee Events", domain: "marqueeevents.co" },
  { name: "Silver Lake Studios", domain: "silverlakestudios.tv" },
  { name: "Quartz Gifting", domain: "quartzgifting.com" },
  { name: "Verde Concierge", domain: "verdeconcierge.io" },
  { name: "House of Lumière", domain: "houseoflumiere.co" },
  { name: "North Star Retreats", domain: "northstarretreats.co" },
  { name: "Helix Talent", domain: "helixtalent.co" },
  { name: "Pinecrest Wellness", domain: "pinecrestwellness.com" },
  { name: "Studio Eleven", domain: "studio11.co" },
  { name: "Beacon Hospitality", domain: "beaconhospitality.com" },
];

const SUBJECTS = [
  "Where is my order?",
  "Order arrived damaged",
  "Wrong shade sent",
  "Foundation match help",
  "Missing items in shipment",
  "Return after 30-day window",
  "Refund not received",
  "Cancel order request",
  "Loyalty points not posting",
  "Insider tier issue",
  "Gift card balance question",
  "BOPIS pickup not ready",
  "BOPIS order cancelled at store",
  "Missing samples in order",
  "App crashes at checkout",
  "App login problem",
  "Discount code not working",
  "Influencer code not working",
  "Shipping cost question",
  "Address change after shipping",
  "Question about product ingredients",
  "Allergic reaction concern",
  "Restock alert for backorder",
  "Cancel subscription / Auto-replenish",
  "Birthday gift not received",
  "Klarna / Afterpay split issue",
  "Price match request",
  "Lost package follow-up",
  "Item authenticity concern",
  "Pro discount enrollment",
  "Store experience feedback",
  "Wholesale order question",
];

function randomTags(): string[] {
  const count = faker.number.int({ min: 0, max: 3 });
  const set = new Set<string>();
  while (set.size < count) set.add(pickFrom(TAG_POOL));
  return [...set];
}

// ---------------------------------------------------------------------------
// Comment bank loaded from db/comments.json (hand-curated fake retail-voice
// comments). Buckets are keyed by metric + rating (csat_5, nps_promoter, etc.).
// ---------------------------------------------------------------------------

const COMMENTS_PATH = resolve(process.cwd(), "db/comments.json");
const COMMENT_BANK: Record<string, string[]> = JSON.parse(
  readFileSync(COMMENTS_PATH, "utf-8"),
);

function commentBucket(metric: SurveyType, rating: number): string {
  if (metric === "csat") return `csat_${rating}`;
  if (metric === "ces") return `ces_${rating}`;
  if (metric === "five_star") return `five_star_${rating}`;
  if (metric === "nps") {
    if (rating >= 9) return "nps_promoter";
    if (rating >= 7) return "nps_passive";
    return "nps_detractor";
  }
  return "custom";
}

function pickComment(metric: SurveyType, rating: number): string | null {
  const bucket = commentBucket(metric, rating);
  const pool = COMMENT_BANK[bucket] ?? [];
  if (pool.length === 0) {
    // Fall back to the nearest sentiment-equivalent CSAT bucket
    const fallback = COMMENT_BANK[`csat_${Math.max(1, Math.min(5, rating))}`] ?? [];
    if (fallback.length === 0) return null;
    return pickFrom(fallback);
  }
  return pickFrom(pool);
}

// ---------------------------------------------------------------------------
// Team member groups. Mirrors a real retail support org — frontline care,
// returns, online orders, in-store coordination, loyalty/VIP, escalations.
// ---------------------------------------------------------------------------

const TEAM_MEMBER_GROUP_SPECS: { name: string; description: string }[] = [
  {
    name: "Customer Care",
    description: "First-line support for orders, returns, and general questions.",
  },
  {
    name: "Returns & Exchanges",
    description: "Specialists handling return windows, refunds, and exchanges.",
  },
  {
    name: "Online Orders",
    description: "Web + app order issues, payment, and shipping.",
  },
  {
    name: "Stores & BOPIS",
    description: "In-store pickup, in-store returns, and store-locator help.",
  },
  {
    name: "Loyalty & VIP",
    description: "Insider / Gold / Elite tier support and clienteling.",
  },
  {
    name: "Escalations",
    description: "Senior team for fraud, chargebacks, and escalated cases.",
  },
];

// ---------------------------------------------------------------------------
// Surveys. Bloom Beauty's survey mix mirrors a real retail program — heavy
// CSAT after touchpoints (email, chat, ticket), NPS quarterly + web embed,
// a returns-flow CES, an onboarding five-star, and an internal roadmap.
// ---------------------------------------------------------------------------

type SurveySpec = {
  name: string;
  metric: SurveyType;
  channel: SurveyChannel;
  scale: number;
  weight: number; // share of responses
  questions: SurveyQuestion[];
};

const SURVEY_SPECS: SurveySpec[] = [
  {
    name: "Post-purchase CSAT",
    metric: "csat",
    channel: "oneoff_email",
    scale: 5,
    weight: 18,
    questions: [
      { type: "rating", question: "How satisfied are you with your recent order?", scale: 5 },
      { type: "multi-choice", question: "Did your order arrive as expected?", options: ["Yes", "Mostly", "No"] },
      { type: "comment", question: "Anything we could do better next time?" },
    ],
  },
  {
    name: "Live Chat CSAT",
    metric: "csat",
    channel: "intercom",
    scale: 5,
    weight: 22,
    questions: [
      { type: "rating", question: "How was your chat with our Beauty Advisor?", scale: 5 },
      { type: "comment", question: "What could we have done differently?" },
    ],
  },
  {
    name: "Customer Service Resolution CSAT",
    metric: "csat",
    channel: "zendesk",
    scale: 5,
    weight: 18,
    questions: [
      { type: "rating", question: "How satisfied were you with how we handled your request?", scale: 5 },
      {
        type: "multi-select",
        question: "Where did we do well?",
        options: ["Response speed", "Product knowledge", "Communication", "Follow-through", "Friendliness"],
      },
      { type: "comment", question: "Tell us more about your experience" },
    ],
  },
  {
    name: "Brand NPS Quarterly",
    metric: "nps",
    channel: "oneoff_email",
    scale: 11,
    weight: 12,
    questions: [
      { type: "rating", question: "How likely are you to recommend Bloom Beauty to a friend?", scale: 11 },
      { type: "comment", question: "What's the primary reason for your score?" },
    ],
  },
  {
    name: "Web NPS",
    metric: "nps",
    channel: "web_embed",
    scale: 11,
    weight: 8,
    questions: [
      { type: "rating", question: "How likely are you to recommend Bloom Beauty?", scale: 11 },
      { type: "comment", question: "Anything we could improve about your experience?" },
    ],
  },
  {
    name: "Returns CES",
    metric: "ces",
    channel: "zendesk",
    scale: 5,
    weight: 9,
    questions: [
      { type: "rating", question: "How easy was it to complete your return?", scale: 5 },
      {
        type: "multi-choice",
        question: "Did our team make the return straightforward?",
        options: ["Yes, completely", "Mostly", "Not really"],
      },
      { type: "comment", question: "What would have made it easier?" },
    ],
  },
  {
    name: "First App Open",
    metric: "five_star",
    channel: "web_embed",
    scale: 5,
    weight: 8,
    questions: [
      { type: "rating", question: "How would you rate your first experience with the Bloom app?", scale: 5 },
      {
        type: "multi-select",
        question: "What stood out?",
        options: [
          "Personalized recommendations",
          "Shade match quiz",
          "Easy signup",
          "Beautiful product browse",
          "Nothing in particular",
        ],
      },
      { type: "comment", question: "Anything we should improve about the app onboarding?" },
    ],
  },
  {
    name: "2026 Beauty Insider Roadmap",
    metric: "custom",
    channel: "generic_embed",
    scale: 5,
    weight: 5,
    questions: [
      {
        type: "multi-select",
        question: "Which areas should Bloom invest in next year?",
        options: [
          "Faster shipping and easier returns",
          "More inclusive shade ranges",
          "Better in-app personalization and Beauty Advisor matching",
          "Richer Insider rewards and birthday perks",
          "Cleaner sustainability and packaging story",
        ],
      },
      {
        type: "rating",
        question: "How important is virtual try-on to your shopping experience?",
        scale: 5,
      },
      { type: "comment", question: "What's missing from Bloom for you?" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Custom-properties population. Per-customer, 25-50 of the available defs get
// populated, weighted toward higher-importance fields. Same logic for team
// members but with a smaller pool (8-16 of ~22).
// ---------------------------------------------------------------------------

function buildCustomProperties(
  defs: CustomFieldDef[],
  minFields: number,
  maxFields: number,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const target = faker.number.int({ min: minFields, max: maxFields });
  // Weighted pool: each def appears in the pool `importance` times so higher
  // importance items are likelier to be chosen
  const pool: CustomFieldDef[] = [];
  for (const def of defs) {
    for (let i = 0; i < def.importance; i++) pool.push(def);
  }
  const chosen = new Set<string>();
  let attempts = 0;
  while (chosen.size < Math.min(target, defs.length) && attempts < target * 8) {
    const def = pickFrom(pool);
    if (!chosen.has(def.id)) {
      chosen.add(def.id);
      out[def.id] = def.sample();
    }
    attempts++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Per-answer topic assignment. Rating biases sentiment; per-answer count 0-2.
// Reused-topic dedup runs at roll-up time.
// ---------------------------------------------------------------------------

import { TOPICS } from "../lib/topics";

const POSITIVE_TOPIC_BIAS = [
  "helpfulness",
  "courtesy",
  "active-listening",
  "knowledgeable",
  "above-and-beyond",
  "effectiveness",
  "thoroughness",
  "clarity-of-information",
  "customer-service",
  "general-professionalism",
];

const NEGATIVE_TOPIC_BIAS = [
  "wait-time",
  "communication-frequency",
  "billing-clarity",
  "price",
  "product-issue",
  "product-performance",
  "refund-process",
  "documentation-clarity",
  "usability",
  "consistency",
];

const NEUTRAL_TOPIC_BIAS = [
  "product-inquiries",
  "feature-demo",
  "product-usage",
  "trial",
  "training-materials",
  "product-setup",
];

function topicsForAnswer(
  sentimentLevel: number, // 1 (worst) to 5 (best)
  hasComment: boolean,
): TopicTag[] {
  // Don't tag every answer — multi-choice/select get topics ~30%, comments ~70%
  const baseRate = hasComment ? 0.7 : 0.3;
  if (faker.number.float({ min: 0, max: 1 }) > baseRate) return [];

  const count = faker.helpers.weightedArrayElement([
    { value: 1, weight: 75 },
    { value: 2, weight: 20 },
    { value: 0, weight: 5 },
  ]);
  if (count === 0) return [];

  // Pick from the right pool based on sentiment, with a small cross-pool chance
  // for the mixed-sentiment ("happy with support, unhappy with product") case
  const out: TopicTag[] = [];
  const usedIds = new Set<string>();
  for (let i = 0; i < count; i++) {
    let pool: string[];
    let sentiment: "positive" | "neutral" | "negative";
    if (sentimentLevel >= 4) {
      const r = faker.number.int({ min: 0, max: 99 });
      if (r < 90) {
        pool = POSITIVE_TOPIC_BIAS;
        sentiment = "positive";
      } else if (r < 98) {
        pool = NEUTRAL_TOPIC_BIAS;
        sentiment = "neutral";
      } else {
        pool = NEGATIVE_TOPIC_BIAS;
        sentiment = "negative";
      }
    } else if (sentimentLevel === 3) {
      const r = faker.number.int({ min: 0, max: 99 });
      if (r < 50) {
        pool = NEUTRAL_TOPIC_BIAS;
        sentiment = "neutral";
      } else if (r < 75) {
        pool = NEGATIVE_TOPIC_BIAS;
        sentiment = "negative";
      } else {
        pool = POSITIVE_TOPIC_BIAS;
        sentiment = "positive";
      }
    } else {
      const r = faker.number.int({ min: 0, max: 99 });
      if (r < 85) {
        pool = NEGATIVE_TOPIC_BIAS;
        sentiment = "negative";
      } else if (r < 95) {
        pool = NEUTRAL_TOPIC_BIAS;
        sentiment = "neutral";
      } else {
        pool = POSITIVE_TOPIC_BIAS;
        sentiment = "positive";
      }
    }
    const topicId = pickFrom(pool);
    if (!TOPICS.some((t) => t.id === topicId)) continue;
    if (usedIds.has(topicId)) continue;
    usedIds.add(topicId);
    out.push({ topic: topicId, sentiment });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Survey answer builder. Walks the survey's question definitions and emits
// matching SurveyAnswer values seeded from the rating/sentiment.
// ---------------------------------------------------------------------------

function buildSurveyAnswers(
  survey: SurveySpec,
  rating: number, // value on survey.scale
  comment: string | null,
): SurveyAnswer[] {
  const sentimentLevel = (() => {
    if (survey.scale === 11) {
      if (rating <= 6) return Math.max(1, Math.round(rating / 2));
      if (rating <= 8) return 3;
      return 5;
    }
    return Math.max(1, Math.min(5, rating));
  })();

  const out: SurveyAnswer[] = [];
  for (const q of survey.questions) {
    const hasComment = q.type === "comment";
    const topics = topicsForAnswer(sentimentLevel, hasComment);
    switch (q.type) {
      case "rating":
        out.push({
          type: "rating",
          question: q.question,
          value:
            q.scale === survey.scale
              ? rating
              : remapRating(rating, survey.scale, q.scale, sentimentLevel),
          scale: q.scale,
          topics,
        });
        break;
      case "multi-choice": {
        const value = pickChoiceBySentiment(q.options, sentimentLevel);
        out.push({ type: "multi-choice", question: q.question, options: q.options, value, topics });
        break;
      }
      case "multi-select": {
        const count =
          sentimentLevel >= 4
            ? faker.number.int({ min: 1, max: Math.min(3, q.options.length) })
            : faker.number.int({ min: 0, max: Math.min(2, q.options.length) });
        const value =
          count === 0 ? [] : faker.helpers.arrayElements(q.options, count);
        out.push({ type: "multi-select", question: q.question, options: q.options, value, topics });
        break;
      }
      case "comment": {
        const text =
          comment ??
          (sentimentLevel <= 2 || faker.number.int({ min: 0, max: 99 }) < 35
            ? pickComment(survey.metric, rating)
            : null);
        if (text) {
          out.push({ type: "comment", question: q.question, value: text, topics });
        }
        break;
      }
    }
  }
  return out;
}

function remapRating(
  value: number,
  fromScale: number,
  toScale: number,
  sentimentLevel: number,
): number {
  if (fromScale === toScale) return value;
  const proportion = value / fromScale;
  if (toScale === 5) return Math.max(1, Math.min(5, sentimentLevel));
  return Math.max(0, Math.min(toScale, Math.round(proportion * toScale)));
}

function pickChoiceBySentiment(options: string[], sentimentLevel: number): string {
  if (sentimentLevel >= 4) {
    return faker.helpers.weightedArrayElement([
      { value: options[0], weight: 70 },
      { value: options[Math.min(1, options.length - 1)], weight: 25 },
      { value: options[options.length - 1], weight: 5 },
    ]);
  }
  if (sentimentLevel === 3) {
    return faker.helpers.weightedArrayElement(
      options.map((v, i) => ({ value: v, weight: i === 1 || options.length === 1 ? 60 : 20 })),
    );
  }
  return faker.helpers.weightedArrayElement([
    { value: options[options.length - 1], weight: 60 },
    { value: options[Math.max(0, options.length - 2)], weight: 30 },
    { value: options[0], weight: 10 },
  ]);
}

// ---------------------------------------------------------------------------
// Ticket-message bank. Loaded from db/ticket-messages.json (hand-curated
// Bloom Beauty retail-voice copy). Buckets keyed by subject category, with
// `_default` as a fallback when a subject hasn't been individually scripted.
// Same pattern as db/comments.json — synthetic, no PII, no harvesting.
// ---------------------------------------------------------------------------

const TICKET_MESSAGES_PATH = resolve(process.cwd(), "db/ticket-messages.json");
type MessageBank = {
  [category: string]:
    | string[]
    | {
        customer_initial?: string[];
        customer_followup?: string[];
        agent_reply?: string[];
        agent_resolution?: string[];
      };
};
const MESSAGE_BANK: MessageBank = JSON.parse(
  readFileSync(TICKET_MESSAGES_PATH, "utf-8"),
);

type MessageSlot =
  | "customer_initial"
  | "customer_followup"
  | "agent_reply"
  | "agent_resolution";

function bankCategory(subject: string): string {
  // Map ticket subject to message-bank category. Keep aligned with SUBJECTS.
  const s = subject.toLowerCase();
  if (s.includes("where is my order") || s.includes("lost package")) {
    return s.includes("lost") ? "lost_package" : "shipping_delay";
  }
  if (s.includes("damaged") || s.includes("cracked")) return "damaged_order";
  if (s.includes("wrong shade") || s.includes("foundation match")) {
    return "wrong_shade";
  }
  if (s.includes("missing items")) return "missing_items";
  if (s.includes("missing samples")) return "missing_items";
  if (s.includes("return after") || s.includes("return")) return "return_request";
  if (s.includes("refund")) return "refund_issue";
  if (s.includes("loyalty") || s.includes("insider tier") || s.includes("points"))
    return "loyalty_points";
  if (s.includes("bopis")) return "bopis_issue";
  if (s.includes("app")) return "app_issue";
  if (s.includes("discount code") || s.includes("influencer code"))
    return "discount_code";
  if (
    s.includes("subscription") ||
    s.includes("auto-replenish") ||
    s.includes("cancel order")
  )
    return "subscription";
  if (s.includes("klarna") || s.includes("afterpay") || s.includes("charged"))
    return "payment_issue";
  return "_default";
}

function pickMessage(category: string, slot: MessageSlot): string {
  const bucket = MESSAGE_BANK[category];
  if (bucket && !Array.isArray(bucket) && bucket[slot]?.length) {
    return pickFrom(bucket[slot]!);
  }
  const fallback = MESSAGE_BANK["_default"];
  if (fallback && !Array.isArray(fallback) && fallback[slot]?.length) {
    return pickFrom(fallback[slot]!);
  }
  // Should never hit; degrade to a generic placeholder.
  return "Hi, just following up on this ticket.";
}

function pickInternalNote(): string {
  const notes = MESSAGE_BANK["internal_notes"];
  return Array.isArray(notes) && notes.length
    ? pickFrom(notes)
    : "Internal note.";
}

// ---------------------------------------------------------------------------
// Ticket lifecycle generator. Produces an ordered list of messages + events
// that together describe the ticket from creation through close. Times are
// pinned to the ticket's existing createdAt / firstResponseAt / solvedAt /
// surveySentAt / closedAt so the timeline matches the rolled-up timestamps.
// Mirrors Zendesk's audit + activity-stream conventions: messages live in
// ticket_messages, Change-style events (status / assignee / priority / tag)
// + verb-style events (survey_sent, survey_response_received) live in
// ticket_events.
// ---------------------------------------------------------------------------

type LifecycleInput = {
  ticketId: string;
  subject: string;
  channel: Channel;
  status: TicketStatus;
  priority: TicketPriority;
  customerId: string;
  customerName: string;
  primaryAgentId: string;
  primaryAgentName: string;
  alternateAgentId: string | null;
  alternateAgentName: string | null;
  createdAt: number;
  firstResponseAt: number | null;
  solvedAt: number | null;
  closedAt: number | null;
  tags: string[];
  surveyEligible: boolean;
  surveySentAt: number | null;
  surveyId: string | null;
  responseId: string | null;
  respondedAt: number | null;
};

type LifecycleOutput = {
  messages: NewTicketMessage[];
  events: NewTicketEvent[];
  /** Recomputed message counters so the ticket row stays consistent with
   *  the seeded messages. Caller assigns these back onto the NewTicket. */
  messageCount: number;
  agentMessageCount: number;
};

function buildLifecycle(input: LifecycleInput): LifecycleOutput {
  const messages: NewTicketMessage[] = [];
  const events: NewTicketEvent[] = [];

  const category = bankCategory(input.subject);
  const messageChannel: TicketMessageChannel =
    input.channel === "social" ? "social" : input.channel;

  // ---- create -----------------------------------------------------------
  events.push({
    id: prefixedId("tke"),
    ticketId: input.ticketId,
    actorRole: "customer",
    actorCustomerId: input.customerId,
    actorTeamMemberId: null,
    verb: "ticket_created",
    fieldName: null,
    previousValue: null,
    newValue: null,
    metadata: { channel: input.channel },
    createdAt: new Date(input.createdAt),
  });
  messages.push({
    id: prefixedId("tkm"),
    ticketId: input.ticketId,
    authorRole: "customer",
    customerId: input.customerId,
    teamMemberId: null,
    channel: messageChannel,
    isPublic: true,
    type: "comment",
    body: pickMessage(category, "customer_initial"),
    createdAt: new Date(input.createdAt),
  });

  // ---- system assignment (within a few minutes of creation) -------------
  const assignmentAt =
    input.createdAt + faker.number.int({ min: 1, max: 12 }) * 60 * 1000;
  events.push({
    id: prefixedId("tke"),
    ticketId: input.ticketId,
    actorRole: "system",
    actorTeamMemberId: null,
    actorCustomerId: null,
    verb: "assignee_changed",
    fieldName: "assignee_id",
    previousValue: null,
    newValue: input.primaryAgentId,
    metadata: { assignee_name: input.primaryAgentName, source: "trigger" },
    createdAt: new Date(assignmentAt),
  });

  // If priority is high/urgent, simulate an escalation event a few minutes
  // after assignment. This gives the timeline some texture.
  if (input.priority === "high" || input.priority === "urgent") {
    const escalatedAt =
      assignmentAt + faker.number.int({ min: 3, max: 25 }) * 60 * 1000;
    events.push({
      id: prefixedId("tke"),
      ticketId: input.ticketId,
      actorRole: "agent",
      actorTeamMemberId: input.primaryAgentId,
      actorCustomerId: null,
      verb: "priority_changed",
      fieldName: "priority",
      previousValue: "normal",
      newValue: input.priority,
      metadata: {},
      createdAt: new Date(escalatedAt),
    });
  }

  // ---- first agent reply (status flips new/open if not already) ---------
  if (input.firstResponseAt) {
    // Status flip to open on first touch — only if there hasn't been an
    // explicit pending earlier (we don't model that here).
    events.push({
      id: prefixedId("tke"),
      ticketId: input.ticketId,
      actorRole: "agent",
      actorTeamMemberId: input.primaryAgentId,
      actorCustomerId: null,
      verb: "status_changed",
      fieldName: "status",
      previousValue: "new",
      newValue: "open",
      metadata: {},
      createdAt: new Date(input.firstResponseAt),
    });
    messages.push({
      id: prefixedId("tkm"),
      ticketId: input.ticketId,
      authorRole: "agent",
      customerId: null,
      teamMemberId: input.primaryAgentId,
      channel: messageChannel,
      isPublic: true,
      type: "comment",
      body: pickMessage(category, "agent_reply"),
      createdAt: new Date(input.firstResponseAt),
    });
  }

  // ---- mid-thread back-and-forth ----------------------------------------
  const endTime =
    input.solvedAt ??
    input.closedAt ??
    input.createdAt + 4 * ONE_DAY;
  const startTime = input.firstResponseAt ?? input.createdAt + 10 * 60 * 1000;
  // Number of additional customer/agent exchanges between first reply and
  // resolution. We aim for 1-3 round trips. Bounds keep tickets readable.
  const exchanges = faker.number.int({ min: 1, max: 3 });
  const slotLen = Math.max(
    5 * 60 * 1000,
    Math.floor((endTime - startTime) / Math.max(1, exchanges * 2 + 1)),
  );
  let cursor = startTime + slotLen;

  // ~25% of tickets get an internal note. Place it after the first agent
  // reply but before the resolution.
  const hasInternalNote =
    input.firstResponseAt &&
    faker.number.int({ min: 0, max: 99 }) < 25;

  for (let i = 0; i < exchanges; i++) {
    // Customer follow-up
    messages.push({
      id: prefixedId("tkm"),
      ticketId: input.ticketId,
      authorRole: "customer",
      customerId: input.customerId,
      teamMemberId: null,
      channel: messageChannel,
      isPublic: true,
      type: "comment",
      body: pickMessage(category, "customer_followup"),
      createdAt: new Date(Math.min(cursor, endTime - 60 * 1000)),
    });
    cursor += slotLen;

    // Optional internal note from a *different* agent — happens once, after
    // the first customer follow-up, before the agent's reply.
    if (hasInternalNote && i === 0 && input.alternateAgentId) {
      messages.push({
        id: prefixedId("tkm"),
        ticketId: input.ticketId,
        authorRole: "agent",
        customerId: null,
        teamMemberId: input.alternateAgentId,
        channel: "internal",
        isPublic: false,
        type: "comment",
        body: pickInternalNote(),
        createdAt: new Date(
          Math.min(cursor - slotLen / 2, endTime - 30 * 1000),
        ),
      });
    }

    // Agent reply
    messages.push({
      id: prefixedId("tkm"),
      ticketId: input.ticketId,
      authorRole: "agent",
      customerId: null,
      teamMemberId: input.primaryAgentId,
      channel: messageChannel,
      isPublic: true,
      type: "comment",
      body: pickMessage(category, "agent_reply"),
      createdAt: new Date(Math.min(cursor, endTime - 30 * 1000)),
    });
    cursor += slotLen;
  }

  // ~15% of tickets get reassigned mid-thread (Care passes to Escalations).
  if (
    input.alternateAgentId &&
    input.alternateAgentName &&
    faker.number.int({ min: 0, max: 99 }) < 15 &&
    input.firstResponseAt &&
    input.solvedAt
  ) {
    const reassignAt = Math.floor(
      input.firstResponseAt + (input.solvedAt - input.firstResponseAt) * 0.6,
    );
    events.push({
      id: prefixedId("tke"),
      ticketId: input.ticketId,
      actorRole: "agent",
      actorTeamMemberId: input.primaryAgentId,
      actorCustomerId: null,
      verb: "assignee_changed",
      fieldName: "assignee_id",
      previousValue: input.primaryAgentId,
      newValue: input.alternateAgentId,
      metadata: {
        previous_assignee_name: input.primaryAgentName,
        new_assignee_name: input.alternateAgentName,
      },
      createdAt: new Date(reassignAt),
    });
  }

  // ---- resolution -------------------------------------------------------
  if (input.solvedAt) {
    messages.push({
      id: prefixedId("tkm"),
      ticketId: input.ticketId,
      authorRole: "agent",
      customerId: null,
      teamMemberId: input.primaryAgentId,
      channel: messageChannel,
      isPublic: true,
      type: "comment",
      body: pickMessage(category, "agent_resolution"),
      createdAt: new Date(input.solvedAt - 30 * 1000),
    });
    events.push({
      id: prefixedId("tke"),
      ticketId: input.ticketId,
      actorRole: "agent",
      actorTeamMemberId: input.primaryAgentId,
      actorCustomerId: null,
      verb: "status_changed",
      fieldName: "status",
      previousValue: "open",
      newValue: "solved",
      metadata: {},
      createdAt: new Date(input.solvedAt),
    });
  }

  // ---- survey lifecycle --------------------------------------------------
  if (input.surveySentAt && input.surveyId) {
    events.push({
      id: prefixedId("tke"),
      ticketId: input.ticketId,
      actorRole: "system",
      actorTeamMemberId: null,
      actorCustomerId: null,
      verb: "survey_sent",
      fieldName: null,
      previousValue: null,
      newValue: null,
      metadata: { survey_id: input.surveyId },
      createdAt: new Date(input.surveySentAt),
    });
  }
  if (input.respondedAt && input.responseId) {
    events.push({
      id: prefixedId("tke"),
      ticketId: input.ticketId,
      actorRole: "customer",
      actorCustomerId: input.customerId,
      actorTeamMemberId: null,
      verb: "survey_response_received",
      fieldName: null,
      previousValue: null,
      newValue: null,
      metadata: {
        survey_id: input.surveyId,
        response_id: input.responseId,
      },
      createdAt: new Date(input.respondedAt),
    });
  }

  // ---- close ------------------------------------------------------------
  if (input.closedAt) {
    events.push({
      id: prefixedId("tke"),
      ticketId: input.ticketId,
      actorRole: "system",
      actorTeamMemberId: null,
      actorCustomerId: null,
      verb: "status_changed",
      fieldName: "status",
      previousValue: "solved",
      newValue: "closed",
      metadata: { source: "automation_close" },
      createdAt: new Date(input.closedAt),
    });
  }

  // ---- recompute counters ----------------------------------------------
  const messageCount = messages.length;
  const agentMessageCount = messages.filter(
    (m) => m.authorRole === "agent" && m.isPublic === true,
  ).length;

  // Sort messages + events by createdAt to keep DB inserts in chronological
  // order — useful when reading back without an ORDER BY for sanity checks.
  messages.sort(
    (a, b) =>
      (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime(),
  );
  events.sort(
    (a, b) =>
      (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime(),
  );

  return { messages, events, messageCount, agentMessageCount };
}

function adjustRatingForResolution(
  baseRating: number,
  resolutionMs: number,
): number {
  const hours = resolutionMs / (1000 * 60 * 60);
  let adjusted = baseRating;
  if (hours > 24) adjusted -= 1;
  if (hours > 72) adjusted -= 1;
  if (hours > 168) adjusted -= 1;
  return Math.max(1, Math.min(5, adjusted));
}

// ---------------------------------------------------------------------------
// Main seed.
// ---------------------------------------------------------------------------

async function seed() {
  console.log("Resetting tables...");
  await db.delete(schema.coachingNotes);
  await db.delete(schema.evaluationCategoryScores);
  await db.delete(schema.evaluations);
  await db.delete(schema.scorecardCriteria);
  await db.delete(schema.scorecardCategories);
  await db.delete(schema.scorecards);
  await db.delete(schema.ticketMessages);
  await db.delete(schema.ticketEvents);
  await db.delete(schema.responses);
  await db.delete(schema.tickets);
  await db.delete(schema.customers);
  await db.delete(schema.teamMembers);
  await db.delete(schema.teamMemberGroups);
  await db.delete(schema.surveys);
  await db.delete(schema.savedViews);

  console.log("Generating team member groups...");
  const teamMemberGroups: NewTeamMemberGroup[] = TEAM_MEMBER_GROUP_SPECS.map(
    (spec) => ({
      id: prefixedId("tmg"),
      name: spec.name,
      description: spec.description,
      createdAt: new Date(NOW - faker.number.int({ min: 365, max: 900 }) * ONE_DAY),
      updatedAt: new Date(NOW),
    }),
  );
  await db.insert(schema.teamMemberGroups).values(teamMemberGroups);
  const groupIdByName = new Map(
    teamMemberGroups.map((g) => [g.name, g.id!] as const),
  );

  console.log("Generating surveys...");
  const surveys: NewSurvey[] = SURVEY_SPECS.map((spec) => ({
    id: prefixedId("svy"),
    name: spec.name,
    metric: spec.metric,
    channel: spec.channel,
    status: "active",
    scale: spec.scale,
    questions: spec.questions,
    createdAt: new Date(NOW - faker.number.int({ min: 90, max: 540 }) * ONE_DAY),
    updatedAt: new Date(NOW),
  }));
  await db.insert(schema.surveys).values(surveys);

  // Maps survey.id -> SurveySpec for response generation
  const surveyById = new Map(surveys.map((s, i) => [s.id!, SURVEY_SPECS[i]]));
  const surveyWeightPool: string[] = [];
  surveys.forEach((s, i) => {
    for (let w = 0; w < SURVEY_SPECS[i].weight; w++) surveyWeightPool.push(s.id!);
  });

  console.log("Generating customers...");
  const customers: NewCustomer[] = [];

  // Named detractor B2B accounts first — these consistently produce bad
  // responses, useful for the company-rollup demo.
  for (const account of NAMED_DETRACTOR_COMPANIES) {
    customers.push({
      id: prefixedId("cus"),
      name: faker.person.fullName(),
      email: faker.internet
        .email()
        .toLowerCase()
        .replace(/@.*$/, `@${account.domain}`),
      tier: "elite",
      language: "en",
      company: account.name,
      companyExternalId: faker.string.numeric(11),
      companyDomain: account.domain,
      helpdeskExternalId: faker.string.numeric(7),
      customProperties: buildCustomProperties(CUSTOMER_CUSTOM_FIELDS, 30, 50),
      createdAt: new Date(NOW - 300 * ONE_DAY),
      updatedAt: new Date(NOW),
    });
  }

  const TARGET_CUSTOMERS = 1200;
  for (let i = customers.length; i < TARGET_CUSTOMERS; i++) {
    // ~5% of customers are B2B (wholesale, gifting, influencer, partner).
    const isB2B = faker.number.int({ min: 0, max: 99 }) < 5;
    const b2bAccount = isB2B ? pickFrom(B2B_COMPANIES) : null;
    const language =
      faker.number.int({ min: 0, max: 99 }) < 70 ? pickFrom(LANGUAGES) : null;

    const tier = pickWeighted(TIER_WEIGHTS);
    const email = isB2B && b2bAccount
      ? faker.internet
          .email()
          .toLowerCase()
          .replace(/@.*$/, `@${b2bAccount.domain}`)
      : faker.internet.email().toLowerCase();

    customers.push({
      id: prefixedId("cus"),
      name: faker.person.fullName(),
      email,
      tier,
      language,
      company: b2bAccount?.name ?? null,
      companyExternalId: b2bAccount ? faker.string.numeric(11) : null,
      companyDomain: b2bAccount?.domain ?? null,
      helpdeskExternalId: faker.string.numeric(7),
      customProperties: buildCustomProperties(CUSTOMER_CUSTOM_FIELDS, 25, 50),
      createdAt: new Date(
        NOW - faker.number.int({ min: 1, max: HORIZON_DAYS }) * ONE_DAY,
      ),
      updatedAt: new Date(NOW),
    });
  }

  console.log("Generating team members...");
  const teamMembers: NewTeamMember[] = [];
  const totalTeamMembers = 25;
  // Bias group assignment — Customer Care is the biggest bucket.
  const groupAssignmentPool: string[] = [
    ...Array(8).fill(groupIdByName.get("Customer Care")!),
    ...Array(4).fill(groupIdByName.get("Returns & Exchanges")!),
    ...Array(4).fill(groupIdByName.get("Online Orders")!),
    ...Array(3).fill(groupIdByName.get("Stores & BOPIS")!),
    ...Array(3).fill(groupIdByName.get("Loyalty & VIP")!),
    ...Array(3).fill(groupIdByName.get("Escalations")!),
  ];

  for (let i = 0; i < totalTeamMembers; i++) {
    const groupId = groupAssignmentPool[i % groupAssignmentPool.length];
    const team = i < 10 ? TEAMS[0] : i < 20 ? TEAMS[1] : TEAMS[2];
    teamMembers.push({
      id: prefixedId("tm"),
      name: faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      role: pickFrom(SUPPORT_ROLES),
      team,
      region: pickFrom(REGIONS),
      language: pickFrom(LANGUAGES),
      groupId,
      helpdeskExternalId: faker.string.numeric(7),
      avatarColor: pickFrom(AVATAR_COLORS),
      customProperties: buildCustomProperties(TEAM_MEMBER_CUSTOM_FIELDS, 8, 16),
      createdAt: new Date(
        NOW - faker.number.int({ min: 30, max: HORIZON_DAYS }) * ONE_DAY,
      ),
      updatedAt: new Date(NOW),
    });
  }

  // 4 of the 25 agents are "low performers" — shifted-down rating distribution
  const lowPerformerIds = new Set(
    faker.helpers.arrayElements(
      teamMembers.map((t) => t.id!),
      4,
    ),
  );

  console.log("Inserting customers and team members...");
  await db.transaction(async (tx) => {
    const customerChunkSize = 200;
    for (let i = 0; i < customers.length; i += customerChunkSize) {
      await tx
        .insert(schema.customers)
        .values(customers.slice(i, i + customerChunkSize));
    }
    await tx.insert(schema.teamMembers).values(teamMembers);
  });

  console.log("Generating 50,000 tickets + responses...");
  const detractorCompanyNames = new Set(
    NAMED_DETRACTOR_COMPANIES.map((d) => d.name),
  );
  const detractorCustomerIds = new Set(
    customers
      .filter((c) => c.company && detractorCompanyNames.has(c.company))
      .map((c) => c.id!),
  );
  const customerIds = customers.map((c) => c.id!);
  const agentIds = teamMembers.map((t) => t.id!);

  const TARGET_TICKETS = 50_000;
  // Number of tickets that get a fully-seeded message + event timeline.
  // Starting small while we shape the data; expanding is a follow-up.
  // These are the "conversation-mockup" tickets that get QA evaluations.
  const TARGET_TIMELINE_TICKETS = 50;
  const tickets: NewTicket[] = [];
  const responses: NewResponse[] = [];
  const ticketMessages: NewTicketMessage[] = [];
  const ticketEvents: NewTicketEvent[] = [];
  let timelinesAttached = 0;
  // Track which tickets got the full lifecycle treatment — these are the
  // ones that get tagged + QA-scored at the end of the seed run.
  const mockupTicketIds = new Set<string>();

  for (let i = 0; i < TARGET_TICKETS; i++) {
    const daysAgo = faker.number.int({ min: 0, max: HORIZON_DAYS });
    const baseCreated = NOW - daysAgo * ONE_DAY;
    const createdDate = new Date(baseCreated);
    const dow = createdDate.getUTCDay();
    if ((dow === 0 || dow === 6) && faker.number.int({ min: 0, max: 99 }) < 60) {
      createdDate.setUTCDate(
        createdDate.getUTCDate() - faker.number.int({ min: 1, max: 2 }),
      );
    }
    const createdAt = createdDate.getTime();

    const status = pickWeighted(STATUS_WEIGHTS);
    const channel = pickWeighted(CHANNEL_WEIGHTS);
    const priority = pickWeighted(PRIORITY_WEIGHTS);
    const customerId = pickFrom(customerIds);
    const isDetractorCustomer = detractorCustomerIds.has(customerId);
    const agentId = pickFrom(agentIds);
    const isLowPerformer = lowPerformerIds.has(agentId);

    let firstResponseAt: number | null = null;
    let solvedAt: number | null = null;
    let closedAt: number | null = null;
    if (status !== "open") {
      firstResponseAt =
        createdAt + faker.number.int({ min: 5, max: 60 * 8 }) * 60 * 1000;
    }
    if (status === "solved" || status === "closed") {
      const resolutionHours = faker.helpers.weightedArrayElement([
        { value: faker.number.int({ min: 1, max: 6 }), weight: 50 },
        { value: faker.number.int({ min: 6, max: 24 }), weight: 30 },
        { value: faker.number.int({ min: 24, max: 72 }), weight: 15 },
        { value: faker.number.int({ min: 72, max: 240 }), weight: 5 },
      ]);
      solvedAt = createdAt + resolutionHours * 60 * 60 * 1000;
    }
    if (status === "closed" && solvedAt) {
      closedAt = solvedAt + faker.number.int({ min: 1, max: 7 }) * ONE_DAY;
    }

    let messageCount = faker.number.int({ min: 2, max: 12 });
    let agentMessageCount = Math.floor(
      messageCount * faker.number.float({ min: 0.3, max: 0.6 }),
    );

    const surveyEligible =
      (status === "solved" || status === "closed") && channel !== "social";

    let surveySentAt: number | null = null;
    let surveyNotSentReason: SurveyNotSentReason | null = null;
    let attachResponse = false;

    if (surveyEligible && solvedAt) {
      const notSentRoll = faker.number.int({ min: 0, max: 99 });
      if (notSentRoll < 11) {
        surveyNotSentReason = pickWeighted(NOT_SENT_REASONS);
      } else {
        surveySentAt =
          solvedAt + faker.number.int({ min: 1, max: 30 }) * 60 * 1000;
        if (faker.number.int({ min: 0, max: 99 }) < 38) {
          attachResponse = true;
        }
      }
    } else if (!surveyEligible && status !== "open" && status !== "pending") {
      surveyNotSentReason = pickWeighted(NOT_SENT_REASONS);
    }

    const ticketId = prefixedId("tkt");
    const subject = pickFrom(SUBJECTS);

    // Build the response first (if any) so the lifecycle generator knows
    // both the surveyId and the responseId for survey_* events.
    let responseEntry: NewResponse | null = null;
    let surveyIdForLifecycle: string | null = null;
    let respondedAtForLifecycle: number | null = null;
    if (attachResponse && solvedAt) {
      let baseRating = pickWeighted(RATING_WEIGHTS);
      baseRating = adjustRatingForResolution(baseRating, solvedAt - createdAt);
      if (isLowPerformer && faker.number.int({ min: 0, max: 99 }) < 60) {
        baseRating = Math.max(1, baseRating - 1);
      }
      if (isDetractorCustomer && faker.number.int({ min: 0, max: 99 }) < 75) {
        baseRating = Math.max(1, Math.min(2, baseRating));
      }
      const respondedAt =
        surveySentAt! + faker.number.int({ min: 5, max: 60 * 48 }) * 60 * 1000;
      const surveyId = pickFrom(surveyWeightPool);
      const survey = surveyById.get(surveyId)!;

      // Project the 1-5 base rating into the survey's scale
      let storedRating: number;
      if (survey.scale === 11) {
        storedRating =
          baseRating === 1
            ? 1
            : baseRating === 2
              ? 4
              : baseRating === 3
                ? 7
                : baseRating === 4
                  ? 9
                  : 10;
      } else {
        storedRating = baseRating;
      }

      const comment = pickComment(survey.metric, storedRating);
      const answers = buildSurveyAnswers(survey, storedRating, comment);
      const topics = rollupTopics(answers.map((a) => a.topics));

      responseEntry = {
        id: prefixedId("rsp"),
        ticketId,
        customerId,
        teamMemberId: agentId,
        surveyId,
        surveyType: survey.metric,
        rating: storedRating,
        scale: survey.scale,
        comment,
        respondedAt: new Date(respondedAt),
        answers,
        topics,
      };
      responses.push(responseEntry);
      surveyIdForLifecycle = surveyId;
      respondedAtForLifecycle = respondedAt;
    } else if (surveySentAt) {
      // Survey was sent but customer didn't respond yet. We still want a
      // survey_sent event in the timeline, so pick a survey ID for the
      // metadata even though there's no response row.
      surveyIdForLifecycle = pickFrom(surveyWeightPool);
    }

    // Pick a fully-seeded timeline for the first TARGET_TIMELINE_TICKETS
    // eligible (solved/closed) tickets. The 3% gate spreads chosen tickets
    // across the corpus rather than clustering them at the start.
    if (
      timelinesAttached < TARGET_TIMELINE_TICKETS &&
      (status === "solved" || status === "closed") &&
      faker.number.int({ min: 0, max: 99 }) < 3
    ) {
      const customer = customers.find((c) => c.id === customerId)!;
      const agent = teamMembers.find((t) => t.id === agentId)!;
      // Pick an alternate agent (for reassignment or internal-note authors)
      // from a different group when possible, otherwise any other agent.
      const alternates = teamMembers.filter(
        (t) => t.id !== agentId && t.groupId !== agent.groupId,
      );
      const alternate =
        alternates.length > 0
          ? pickFrom(alternates)
          : teamMembers.find((t) => t.id !== agentId) ?? null;

      const lifecycle = buildLifecycle({
        ticketId,
        subject,
        channel,
        status,
        priority,
        customerId,
        customerName: customer.name,
        primaryAgentId: agentId,
        primaryAgentName: agent.name,
        alternateAgentId: alternate?.id ?? null,
        alternateAgentName: alternate?.name ?? null,
        createdAt,
        firstResponseAt,
        solvedAt,
        closedAt,
        tags: [],
        surveyEligible,
        surveySentAt,
        surveyId: surveyIdForLifecycle,
        responseId: responseEntry?.id ?? null,
        respondedAt: respondedAtForLifecycle,
      });
      ticketMessages.push(...lifecycle.messages);
      ticketEvents.push(...lifecycle.events);
      messageCount = lifecycle.messageCount;
      agentMessageCount = lifecycle.agentMessageCount;
      timelinesAttached++;
      mockupTicketIds.add(ticketId);
    }

    // Mockup tickets get the conversation-mockup tag prepended to whatever
    // random tags they pulled — this is the SVP-51 absorption: the tag is
    // how downstream code (QA pages, filters) knows which tickets have full
    // lifecycles to lean on.
    const baseTags = randomTags();
    const finalTags = mockupTicketIds.has(ticketId)
      ? [CONVERSATION_MOCKUP_TAG, ...baseTags]
      : baseTags;

    tickets.push({
      id: ticketId,
      subject,
      status,
      channel,
      priority,
      helpdesk: "zendesk",
      helpdeskExternalId: faker.string.numeric(8),
      customerId,
      assignedTeamMemberId: agentId,
      createdAt: new Date(createdAt),
      firstResponseAt: firstResponseAt ? new Date(firstResponseAt) : null,
      solvedAt: solvedAt ? new Date(solvedAt) : null,
      closedAt: closedAt ? new Date(closedAt) : null,
      messageCount,
      agentMessageCount,
      tags: finalTags,
      surveyEligible,
      surveySentAt: surveySentAt ? new Date(surveySentAt) : null,
      surveyNotSentReason,
    });
  }

  console.log(
    `Inserting ${tickets.length} tickets + ${responses.length} responses + ${ticketMessages.length} messages + ${ticketEvents.length} events...`,
  );
  await db.transaction(async (tx) => {
    const chunk = 1000;
    for (let i = 0; i < tickets.length; i += chunk) {
      await tx
        .insert(schema.tickets)
        .values(tickets.slice(i, i + chunk));
    }
    for (let i = 0; i < responses.length; i += chunk) {
      await tx
        .insert(schema.responses)
        .values(responses.slice(i, i + chunk));
    }
    for (let i = 0; i < ticketMessages.length; i += chunk) {
      await tx
        .insert(schema.ticketMessages)
        .values(ticketMessages.slice(i, i + chunk));
    }
    for (let i = 0; i < ticketEvents.length; i += chunk) {
      await tx
        .insert(schema.ticketEvents)
        .values(ticketEvents.slice(i, i + chunk));
    }
  });

  // -------------------------------------------------------------------------
  // QA seed (SVP-53). Hydrate the default scorecard from code, then score
  // each conversation-mockup ticket through the mock provider and persist
  // the resulting evaluation + per-category scores + coaching note.
  // -------------------------------------------------------------------------

  console.log("Hydrating default QA scorecard...");
  const scorecardId = prefixedId("sc");
  const scorecardRow: NewScorecard = {
    id: scorecardId,
    name: DEFAULT_SCORECARD.name,
    isDefault: DEFAULT_SCORECARD.isDefault,
    enabled: DEFAULT_SCORECARD.enabled,
    version: DEFAULT_SCORECARD.version,
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
  };
  const categoryRows: NewScorecardCategory[] = [];
  const criterionRows: NewScorecardCriterion[] = [];
  // categoryId by name + per-category criterion ids — used to map provider
  // input/output back to DB ids without a second query roundtrip.
  const categoryIdByName = new Map<string, string>();
  const criterionIdsByCategoryName = new Map<string, string[]>();
  DEFAULT_SCORECARD.categories.forEach((category, categoryIdx) => {
    const categoryId = prefixedId("scc");
    categoryIdByName.set(category.name, categoryId);
    categoryRows.push({
      id: categoryId,
      scorecardId,
      name: category.name,
      description: category.description,
      weightPercent: category.weightPercent,
      scaleType: category.scaleType,
      order: categoryIdx,
      isAutofail: category.isAutofail,
    });
    const criterionIds: string[] = [];
    category.criteria.forEach((criterion, criterionIdx) => {
      const criterionId = prefixedId("scr");
      criterionIds.push(criterionId);
      criterionRows.push({
        id: criterionId,
        categoryId,
        text: criterion.text,
        anchor5: criterion.anchor5,
        anchor3: criterion.anchor3,
        anchor1: criterion.anchor1,
        order: criterionIdx,
      });
    });
    criterionIdsByCategoryName.set(category.name, criterionIds);
  });
  await db.transaction(async (tx) => {
    await tx.insert(schema.scorecards).values(scorecardRow);
    await tx.insert(schema.scorecardCategories).values(categoryRows);
    await tx.insert(schema.scorecardCriteria).values(criterionRows);
  });

  console.log(
    `Scoring ${mockupTicketIds.size} conversation-mockup tickets via MockScoringProvider...`,
  );
  // Build a ticket-id → messages lookup once so each scoring call doesn't
  // re-scan the full message list.
  const messagesByTicketId = new Map<string, ScoringMessage[]>();
  for (const m of ticketMessages) {
    const list = messagesByTicketId.get(m.ticketId) ?? [];
    list.push({
      id: m.id!,
      authorRole: m.authorRole,
      authorName: null,
      body: m.body,
      isPublic: m.isPublic === false ? false : true,
      createdAt: m.createdAt as Date,
    });
    messagesByTicketId.set(m.ticketId, list);
  }

  // Resolve the scorecard into the shape the provider expects (with DB ids
  // baked in). Same shape the app code will pass at runtime.
  const scoringScorecard: ScoringScorecard = {
    id: scorecardId,
    name: DEFAULT_SCORECARD.name,
    version: DEFAULT_SCORECARD.version,
    autoFailFloor: DEFAULT_SCORECARD.autoFailFloor,
    categories: DEFAULT_SCORECARD.categories.map((category) => {
      const criterionIds = criterionIdsByCategoryName.get(category.name) ?? [];
      return {
        id: categoryIdByName.get(category.name)!,
        name: category.name,
        description: category.description,
        weightPercent: category.weightPercent,
        scaleType: category.scaleType,
        isAutofail: category.isAutofail,
        criteria: category.criteria.map((c, ci) => ({
          id: criterionIds[ci]!,
          text: c.text,
        })),
      };
    }),
  };

  const provider = new MockScoringProvider();
  const evaluationRows: NewEvaluation[] = [];
  const categoryScoreRows: NewEvaluationCategoryScore[] = [];
  const coachingNoteRows: NewCoachingNote[] = [];

  for (const ticket of tickets) {
    if (!mockupTicketIds.has(ticket.id!)) continue;
    const messages = messagesByTicketId.get(ticket.id!) ?? [];
    const input: ScoringInput = {
      ticket: {
        id: ticket.id!,
        subject: ticket.subject,
        channel: ticket.channel,
        status: ticket.status,
        priority: ticket.priority ?? "normal",
        createdAt: ticket.createdAt as Date,
        solvedAt: (ticket.solvedAt as Date | null) ?? null,
        tags: ticket.tags ?? [],
      },
      messages,
      scorecard: scoringScorecard,
    };

    const output = await provider.scoreConversation(input);

    const evaluationId = prefixedId("evl");
    const scoredAt = ticket.solvedAt
      ? new Date(((ticket.solvedAt as Date).getTime()) + 60 * 60 * 1000)
      : new Date(NOW);
    const editedStatus = output.autoFailTriggered ? "contested" : "ai_scored";

    evaluationRows.push({
      id: evaluationId,
      ticketId: ticket.id!,
      scorecardId,
      scorecardVersion: DEFAULT_SCORECARD.version,
      scoredTeamMemberId: ticket.assignedTeamMemberId!,
      overallScore: output.overallScore,
      status: editedStatus,
      aiModel: output.aiModel,
      // Confidence stored as integer percent so the column is a plain int.
      aiConfidence: Math.round(output.aiConfidence * 100),
      aiReasoningSummary: output.aiReasoningSummary,
      scoredBy: provider.name,
      scoredAt,
      editedBy: null,
      editedAt: null,
      invalidatedReason: null,
    });

    for (const result of output.categoryScores) {
      categoryScoreRows.push({
        id: prefixedId("ecs"),
        evaluationId,
        categoryId: result.categoryId,
        aiScore: result.aiScore,
        humanScore: null,
        effectiveScore: result.aiScore,
        aiReasoning: result.aiReasoning,
        highlightedMessageIds: result.highlightedMessageIds,
      });
    }

    coachingNoteRows.push({
      id: prefixedId("cnt"),
      evaluationId,
      strengthPoints: output.coachingNote.strengthPoints,
      growthPoints: output.coachingNote.growthPoints,
      exampleMessageIds: output.coachingNote.exampleMessageIds,
      generatedBy: provider.name,
      generatedAt: scoredAt,
    });
  }

  console.log(
    `Inserting ${evaluationRows.length} evaluations + ${categoryScoreRows.length} category scores + ${coachingNoteRows.length} coaching notes...`,
  );
  await db.transaction(async (tx) => {
    if (evaluationRows.length > 0) {
      await tx.insert(schema.evaluations).values(evaluationRows);
    }
    if (categoryScoreRows.length > 0) {
      await tx.insert(schema.evaluationCategoryScores).values(categoryScoreRows);
    }
    if (coachingNoteRows.length > 0) {
      await tx.insert(schema.coachingNotes).values(coachingNoteRows);
    }
  });

  // -------------------------------------------------------------------------
  // Saved views (SVP-85). Runs after every entity has rows so the views have
  // something to filter against. Goes through the same `replaceSavedViews`
  // helper the runtime localStorage-migration path uses — no separate insert.
  // -------------------------------------------------------------------------
  console.log("Seeding saved views...");
  for (const [entity, views] of Object.entries(SEED_VIEWS) as [
    EntityKey,
    (typeof SEED_VIEWS)[EntityKey],
  ][]) {
    await replaceSavedViews(entity, views);
  }

  console.log("Done. Final counts:");
  const [
    surveyCount,
    customerCount,
    teamMemberCount,
    teamMemberGroupCount,
    ticketCount,
    responseCount,
    ticketMessageCount,
    ticketEventCount,
    scorecardCount,
    scorecardCategoryCount,
    scorecardCriterionCount,
    evaluationCount,
    evaluationCategoryScoreCount,
    coachingNoteCount,
    savedViewCount,
  ] = await Promise.all([
    db.$count(schema.surveys),
    db.$count(schema.customers),
    db.$count(schema.teamMembers),
    db.$count(schema.teamMemberGroups),
    db.$count(schema.tickets),
    db.$count(schema.responses),
    db.$count(schema.ticketMessages),
    db.$count(schema.ticketEvents),
    db.$count(schema.scorecards),
    db.$count(schema.scorecardCategories),
    db.$count(schema.scorecardCriteria),
    db.$count(schema.evaluations),
    db.$count(schema.evaluationCategoryScores),
    db.$count(schema.coachingNotes),
    db.$count(schema.savedViews),
  ]);
  console.log({
    surveys: surveyCount,
    customers: customerCount,
    teamMembers: teamMemberCount,
    teamMemberGroups: teamMemberGroupCount,
    tickets: ticketCount,
    responses: responseCount,
    ticketMessages: ticketMessageCount,
    ticketEvents: ticketEventCount,
    timelinesAttached,
    scorecards: scorecardCount,
    scorecardCategories: scorecardCategoryCount,
    scorecardCriteria: scorecardCriterionCount,
    evaluations: evaluationCount,
    evaluationCategoryScores: evaluationCategoryScoreCount,
    coachingNotes: coachingNoteCount,
    savedViews: savedViewCount,
  });
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
