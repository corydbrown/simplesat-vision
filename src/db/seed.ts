import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { faker } from "@faker-js/faker";
import { db, schema } from "./client";
import { prefixedId } from "../lib/ids";
import {
  CUSTOMER_CUSTOM_FIELDS,
  TEAM_MEMBER_CUSTOM_FIELDS,
  type CustomFieldDef,
} from "../lib/properties/custom-fields";
import { rollupTopics } from "../lib/topics";
import type {
  Channel,
  ConversationMessage,
  CustomerTier,
  NewCustomer,
  NewResponse,
  NewSurvey,
  NewTeamMember,
  NewTeamMemberGroup,
  NewTicket,
  SurveyAnswer,
  SurveyChannel,
  SurveyNotSentReason,
  SurveyQuestion,
  SurveyType,
  TicketPriority,
  TicketStatus,
  TopicTag,
} from "./schema";

faker.seed(42);

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

const CUSTOMER_MSG_TEMPLATES = [
  "Hi! I'm having an issue with my order — {{problem}} Can you help?",
  "Hey, my recent order — {{problem}} Hoping you can sort this out.",
  "Just following up on this. {{problem}} Any update?",
  "Quick question on a return: {{problem}} What's the next step?",
  "Hi there, having trouble with the app: {{problem}} Could you take a look?",
];
const AGENT_MSG_TEMPLATES = [
  "Thanks for reaching out! I'm so sorry to hear that — let me dig into your order right now.",
  "Happy to help! Could you try {{suggestion}}? That usually clears it up on our side.",
  "I've gone ahead and {{action}}. You should see a confirmation in your inbox shortly. Let me know!",
  "Apologies for the trouble. I've issued a replacement and added a few extra samples on us.",
  "Great question. I've checked with our store team and {{action}}. You're all set.",
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
// Conversation builder. Retail-flavored placeholders.
// ---------------------------------------------------------------------------

function buildConversation(
  customerName: string,
  agentName: string,
  createdAt: number,
  solvedAt: number | null,
): ConversationMessage[] {
  const messageCount = faker.number.int({ min: 3, max: 7 });
  const messages: ConversationMessage[] = [];
  const end = solvedAt ?? createdAt + 4 * ONE_DAY;
  const step = Math.max(1, Math.floor((end - createdAt) / messageCount));
  let cursor = createdAt;
  const problemSnippets = [
    "the foundation arrived in the wrong shade",
    "my order has been stuck in transit for a week",
    "I never received the samples that were supposed to ship with my order",
    "the perfume bottle was cracked when it arrived",
    "my loyalty points haven't posted from last month's purchase",
    "the discount code at checkout isn't applying",
    "BOPIS at the Beverly Hills store said my order wasn't ready",
    "the app keeps logging me out at checkout",
    "I was charged twice for the same order",
    "the return label in my account isn't generating",
  ];
  const suggestions = [
    "force-closing and reopening the app",
    "clearing your cart and re-adding the items",
    "signing out and back in",
    "checking your spam folder",
  ];
  const actions = [
    "issued a replacement and added 500 bonus points",
    "refunded the difference back to your original payment method",
    "shipped a replacement overnight, on us",
    "reset your Insider tier and credited the missing points",
    "flagged this with our store team and confirmed your pickup is ready",
  ];
  for (let i = 0; i < messageCount; i++) {
    const isCustomer = i % 2 === 0;
    const tpl = isCustomer
      ? pickFrom(CUSTOMER_MSG_TEMPLATES)
      : pickFrom(AGENT_MSG_TEMPLATES);
    const body = tpl
      .replace("{{problem}}", pickFrom(problemSnippets))
      .replace("{{suggestion}}", pickFrom(suggestions))
      .replace("{{action}}", pickFrom(actions));
    messages.push({
      author: isCustomer ? customerName : agentName,
      role: isCustomer ? "customer" : "agent",
      time: new Date(cursor).toISOString(),
      body,
    });
    cursor += step + faker.number.int({ min: 0, max: step });
  }
  return messages;
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
  await db.delete(schema.qaEvaluations);
  await db.delete(schema.responses);
  await db.delete(schema.tickets);
  await db.delete(schema.customers);
  await db.delete(schema.teamMembers);
  await db.delete(schema.teamMemberGroups);
  await db.delete(schema.surveys);

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
  const TARGET_CONVERSATION_TICKETS = 50;
  const tickets: NewTicket[] = [];
  const responses: NewResponse[] = [];
  let conversationsAttached = 0;

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

    const messageCount = faker.number.int({ min: 2, max: 12 });
    const agentMessageCount = Math.floor(
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

    let conversation: ConversationMessage[] = [];
    if (
      conversationsAttached < TARGET_CONVERSATION_TICKETS &&
      (status === "solved" || status === "closed") &&
      faker.number.int({ min: 0, max: 99 }) < 3
    ) {
      const customer = customers.find((c) => c.id === customerId)!;
      const agent = teamMembers.find((t) => t.id === agentId)!;
      conversation = buildConversation(
        customer.name,
        agent.name,
        createdAt,
        solvedAt,
      );
      conversationsAttached++;
    }

    tickets.push({
      id: ticketId,
      subject: pickFrom(SUBJECTS),
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
      tags: randomTags(),
      surveyEligible,
      surveySentAt: surveySentAt ? new Date(surveySentAt) : null,
      surveyNotSentReason,
      conversation,
    });

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

      responses.push({
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
      });
    }
  }

  console.log(
    `Inserting ${tickets.length} tickets + ${responses.length} responses...`,
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
  });

  console.log("Done. Final counts:");
  const [
    surveyCount,
    customerCount,
    teamMemberCount,
    teamMemberGroupCount,
    ticketCount,
    responseCount,
  ] = await Promise.all([
    db.$count(schema.surveys),
    db.$count(schema.customers),
    db.$count(schema.teamMembers),
    db.$count(schema.teamMemberGroups),
    db.$count(schema.tickets),
    db.$count(schema.responses),
  ]);
  console.log({
    surveys: surveyCount,
    customers: customerCount,
    teamMembers: teamMemberCount,
    teamMemberGroups: teamMemberGroupCount,
    tickets: ticketCount,
    responses: responseCount,
    conversationsAttached,
  });
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
