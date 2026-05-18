import { faker } from "@faker-js/faker";
import { db, schema } from "./client";
import { prefixedId } from "../lib/ids";
import type {
  Channel,
  ConversationMessage,
  CustomerTier,
  NewCustomer,
  NewResponse,
  NewTeamMember,
  NewTicket,
  SurveyAnswer,
  SurveyNotSentReason,
  TicketStatus,
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

const TIER_WEIGHTS: Weighted<CustomerTier>[] = [
  { value: "starter", weight: 60 },
  { value: "pro", weight: 30 },
  { value: "enterprise", weight: 10 },
];

const CHANNEL_WEIGHTS: Weighted<Channel>[] = [
  { value: "email", weight: 70 },
  { value: "chat", weight: 20 },
  { value: "phone", weight: 8 },
  { value: "social", weight: 2 },
];

const STATUS_WEIGHTS: Weighted<TicketStatus>[] = [
  { value: "solved", weight: 60 },
  { value: "closed", weight: 25 },
  { value: "pending", weight: 10 },
  { value: "open", weight: 5 },
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

const TEAMS = ["Tier 1", "Tier 2"] as const;
const SUPPORT_ROLES = [
  "Support Agent",
  "Senior Agent",
  "Team Lead",
  "Support Specialist",
];

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
  "billing",
  "shipping",
  "refund",
  "bug",
  "onboarding",
  "feature-request",
  "vip",
  "escalation",
  "integration",
  "account",
];

const NAMED_DETRACTOR_COMPANIES = ["Hooli", "Globex", "Umbrella Co"];

const SUBJECTS = [
  "Cannot log in",
  "Where is my order?",
  "Refund request",
  "Integration broken",
  "Feature question",
  "Billing discrepancy",
  "Account locked",
  "Password reset not working",
  "API rate limit issue",
  "Webhook not firing",
  "Dashboard slow",
  "Export failing",
  "Plan upgrade",
  "Cancel subscription",
  "Data import help",
  "User permissions",
  "SSO setup",
  "Mobile app crash",
  "Email notification missing",
  "Survey link not working",
];

const CUSTOMER_MSG_TEMPLATES = [
  "Hi, I'm running into an issue. {{problem}} Can you help?",
  "Hey team - {{problem}} It's been blocking us all morning.",
  "Following up on this - {{problem}} Any update?",
  "Quick question: {{problem}} What should I try next?",
];
const AGENT_MSG_TEMPLATES = [
  "Thanks for reaching out. I can see what's happening here - let me take a closer look.",
  "Great question. Could you try {{suggestion}}? That usually clears it up.",
  "I've gone ahead and {{action}}. Can you confirm it's working on your side now?",
  "Apologies for the trouble. We've identified the cause and are rolling out a fix shortly.",
  "Got it - thanks for the details. I'm escalating this to our integrations team now.",
];

function pickFrom<T>(arr: readonly T[]): T {
  return arr[faker.number.int({ min: 0, max: arr.length - 1 })];
}

function randomTags(): string[] {
  const count = faker.number.int({ min: 0, max: 3 });
  const set = new Set<string>();
  while (set.size < count) set.add(pickFrom(TAG_POOL));
  return [...set];
}

const RESOLVED_OPTIONS = ["Yes", "Partially", "No"] as const;
const POSITIVES = [
  "Response speed",
  "Expertise",
  "Communication",
  "Follow-through",
  "Friendliness",
] as const;
const NEGATIVES = [
  "Took too long",
  "Did not understand my issue",
  "Hard to reach a human",
  "Issue still not resolved",
  "Felt impersonal",
] as const;

function buildSurveyAnswers(
  rating: number,
  comment: string | null,
): SurveyAnswer[] {
  const answers: SurveyAnswer[] = [];

  // Q1: rating (mirrors responses.rating)
  answers.push({
    type: "rating",
    question: "How satisfied are you with this support experience?",
    value: rating,
    scale: 5,
  });

  // Q2: multi-choice resolution
  const resolvedValue =
    rating >= 4
      ? RESOLVED_OPTIONS[0]
      : rating === 3
        ? faker.helpers.weightedArrayElement([
            { value: RESOLVED_OPTIONS[0], weight: 30 },
            { value: RESOLVED_OPTIONS[1], weight: 60 },
            { value: RESOLVED_OPTIONS[2], weight: 10 },
          ])
        : rating === 2
          ? faker.helpers.weightedArrayElement([
              { value: RESOLVED_OPTIONS[1], weight: 50 },
              { value: RESOLVED_OPTIONS[2], weight: 50 },
            ])
          : RESOLVED_OPTIONS[2];
  answers.push({
    type: "multi-choice",
    question: "Was your issue resolved?",
    options: [...RESOLVED_OPTIONS],
    value: resolvedValue,
  });

  // Q3: multi-select on positives or negatives (depending on rating)
  if (rating >= 4) {
    const count = faker.number.int({ min: 1, max: 3 });
    const picks = faker.helpers.arrayElements([...POSITIVES], count);
    answers.push({
      type: "multi-select",
      question: "What did we do well?",
      options: [...POSITIVES],
      value: picks,
    });
  } else {
    const count = faker.number.int({ min: 0, max: 3 });
    const picks =
      count === 0 ? [] : faker.helpers.arrayElements([...NEGATIVES], count);
    answers.push({
      type: "multi-select",
      question: "Where could we improve?",
      options: [...NEGATIVES],
      value: picks,
    });
  }

  // Q4: comment (mirrors responses.comment)
  if (comment) {
    answers.push({
      type: "comment",
      question: "Anything else we should know?",
      value: comment,
    });
  }

  return answers;
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
  for (let i = 0; i < messageCount; i++) {
    const isCustomer = i % 2 === 0;
    const tpl = isCustomer
      ? pickFrom(CUSTOMER_MSG_TEMPLATES)
      : pickFrom(AGENT_MSG_TEMPLATES);
    const body = tpl
      .replace("{{problem}}", faker.lorem.sentence({ min: 8, max: 14 }))
      .replace("{{suggestion}}", faker.lorem.words(3))
      .replace("{{action}}", faker.lorem.words(4));
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

async function seed() {
  console.log("Resetting tables...");
  db.delete(schema.qaEvaluations).run();
  db.delete(schema.responses).run();
  db.delete(schema.tickets).run();
  db.delete(schema.customers).run();
  db.delete(schema.teamMembers).run();

  console.log("Generating customers...");
  const customers: NewCustomer[] = [];
  for (const company of NAMED_DETRACTOR_COMPANIES) {
    customers.push({
      id: prefixedId("cus"),
      name: faker.person.fullName(),
      email: faker.internet
        .email()
        .toLowerCase()
        .replace(/@.*$/, `@${company.toLowerCase().replace(/\s+/g, "")}.com`),
      company,
      tier: "enterprise",
      helpdeskExternalId: faker.string.numeric(7),
      createdAt: new Date(NOW - 300 * ONE_DAY),
      updatedAt: new Date(NOW),
    });
  }
  for (let i = 0; i < 497; i++) {
    customers.push({
      id: prefixedId("cus"),
      name: faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      company: faker.company.name(),
      tier: pickWeighted(TIER_WEIGHTS),
      helpdeskExternalId: faker.string.numeric(7),
      createdAt: new Date(
        NOW - faker.number.int({ min: 1, max: HORIZON_DAYS }) * ONE_DAY,
      ),
      updatedAt: new Date(NOW),
    });
  }

  console.log("Generating team members...");
  const teamMembers: NewTeamMember[] = [];
  const tier1Count = 15;
  const tier2Count = 10;
  for (let i = 0; i < tier1Count + tier2Count; i++) {
    teamMembers.push({
      id: prefixedId("tm"),
      name: faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      role: pickFrom(SUPPORT_ROLES),
      team: i < tier1Count ? TEAMS[0] : TEAMS[1],
      helpdeskExternalId: faker.string.numeric(7),
      avatarColor: pickFrom(AVATAR_COLORS),
      createdAt: new Date(
        NOW - faker.number.int({ min: 30, max: HORIZON_DAYS }) * ONE_DAY,
      ),
      updatedAt: new Date(NOW),
    });
  }

  // 4 of the 25 agents are "low performers" - shifted-down rating distribution
  const lowPerformerIds = new Set(
    faker.helpers.arrayElements(
      teamMembers.map((t) => t.id!),
      4,
    ),
  );

  console.log("Inserting customers and team members...");
  db.transaction((tx) => {
    const customerChunkSize = 200;
    for (let i = 0; i < customers.length; i += customerChunkSize) {
      tx.insert(schema.customers)
        .values(customers.slice(i, i + customerChunkSize))
        .run();
    }
    tx.insert(schema.teamMembers).values(teamMembers).run();
  });

  console.log("Generating 50,000 tickets + responses...");
  const detractorCustomerIds = new Set(
    customers.filter((c) => NAMED_DETRACTOR_COMPANIES.includes(c.company)).map(
      (c) => c.id!,
    ),
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
    // Slight Mon/Tue bump, dip on Sat/Sun: rerandomize day occasionally
    const dow = createdDate.getUTCDay();
    if ((dow === 0 || dow === 6) && faker.number.int({ min: 0, max: 99 }) < 60) {
      createdDate.setUTCDate(
        createdDate.getUTCDate() - faker.number.int({ min: 1, max: 2 }),
      );
    }
    const createdAt = createdDate.getTime();

    const status = pickWeighted(STATUS_WEIGHTS);
    const channel = pickWeighted(CHANNEL_WEIGHTS);
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
      // ~11% of eligible-but-not-sent tickets get a not-sent reason
      const notSentRoll = faker.number.int({ min: 0, max: 99 });
      if (notSentRoll < 11) {
        surveyNotSentReason = pickWeighted(NOT_SENT_REASONS);
      } else {
        surveySentAt =
          solvedAt + faker.number.int({ min: 1, max: 30 }) * 60 * 1000;
        // 30% of sent surveys get responded to (yields ~15k responses)
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

      const comment =
        baseRating <= 3 && faker.number.int({ min: 0, max: 99 }) < 70
          ? faker.lorem.sentence({ min: 6, max: 18 })
          : baseRating === 5 && faker.number.int({ min: 0, max: 99 }) < 30
            ? faker.lorem.sentence({ min: 4, max: 10 })
            : null;

      const answers = buildSurveyAnswers(baseRating, comment);

      responses.push({
        id: prefixedId("rsp"),
        ticketId,
        customerId,
        teamMemberId: agentId,
        surveyType: "csat",
        rating: baseRating,
        scale: 5,
        comment,
        respondedAt: new Date(respondedAt),
        answers,
      });
    }
  }

  console.log(
    `Inserting ${tickets.length} tickets + ${responses.length} responses...`,
  );
  db.transaction((tx) => {
    const chunk = 1000;
    for (let i = 0; i < tickets.length; i += chunk) {
      tx.insert(schema.tickets)
        .values(tickets.slice(i, i + chunk))
        .run();
    }
    for (let i = 0; i < responses.length; i += chunk) {
      tx.insert(schema.responses)
        .values(responses.slice(i, i + chunk))
        .run();
    }
  });

  console.log("Done. Final counts:");
  const [customerCount, teamMemberCount, ticketCount, responseCount] =
    await Promise.all([
      db.$count(schema.customers),
      db.$count(schema.teamMembers),
      db.$count(schema.tickets),
      db.$count(schema.responses),
    ]);
  console.log({
    customers: customerCount,
    teamMembers: teamMemberCount,
    tickets: ticketCount,
    responses: responseCount,
    conversationsAttached,
  });
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
