import { describe, expect, it } from "vitest";
import { buildSystemPrompt, buildToolSchema, buildUserPrompt } from "./prompt";
import type { ScoringInput } from "./types";

function makeInput(overrides?: Partial<ScoringInput>): ScoringInput {
  return {
    ticket: {
      id: "tic_1",
      subject: "Refund not received",
      channel: "email",
      status: "solved",
      priority: "high",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      solvedAt: new Date("2026-01-02T00:00:00Z"),
      tags: ["billing", "refund"],
      responseRating: 4,
    },
    messages: [
      {
        id: "msg_1",
        authorRole: "customer",
        authorName: "Dana",
        authorSubtype: null,
        body: "Where is my refund?",
        isPublic: true,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
      {
        id: "msg_2",
        authorRole: "agent",
        authorName: null,
        authorSubtype: "human",
        body: "Internal: checking with billing.",
        isPublic: false,
        createdAt: new Date("2026-01-01T01:00:00Z"),
      },
    ],
    target: "human",
    scorecard: {
      id: "sc_1",
      name: "IQS",
      version: 3,
      autoFailFloor: 0,
      scoringPhilosophy: "Reward empathy and resolution.",
      bandDescriptors: ["awful", "poor", "ok", "good", "great"],
      domainContext: "B2C beauty retailer.",
      toneExpectations: "Warm, concise.",
      categories: [
        {
          id: "cat_empathy",
          name: "Empathy",
          description: "Did the agent acknowledge feelings?",
          weightPercent: 60,
          scaleType: "likert_5",
          isAutofail: false,
          criteria: [
            { id: "cr_1", text: "Acknowledged frustration", weightPercent: 60 },
          ],
        },
        {
          id: "cat_compliance",
          name: "Compliance",
          description: "No policy violations.",
          weightPercent: 0,
          scaleType: "binary",
          isAutofail: true,
          criteria: [
            { id: "cr_2", text: "No PII leak", weightPercent: 0 },
          ],
        },
      ],
    },
    ...overrides,
  };
}

describe("buildSystemPrompt", () => {
  it("includes scorecard identity, every category id, and criterion weights", () => {
    const out = buildSystemPrompt(makeInput());
    expect(out).toContain("Scorecard: IQS (v3)");
    expect(out).toContain("Empathy (id: cat_empathy)");
    expect(out).toContain("Compliance (id: cat_compliance)");
    expect(out).toContain("[weight: 60%]");
  });

  it("weaves in the manager-tunable context fields in order", () => {
    const out = buildSystemPrompt(makeInput());
    const phil = out.indexOf("Scoring philosophy:");
    const bands = out.indexOf("Likert-band descriptors:");
    const domain = out.indexOf("Domain context:");
    const tone = out.indexOf("Tone expectations:");
    expect(phil).toBeGreaterThan(-1);
    // ordering contract: philosophy → bands → domain → tone
    expect(phil).toBeLessThan(bands);
    expect(bands).toBeLessThan(domain);
    expect(domain).toBeLessThan(tone);
  });

  it("marks an autofail category and omits the weight suffix for 0-weight criteria", () => {
    const out = buildSystemPrompt(makeInput());
    expect(out).toContain("Auto-fail: failing this category floors");
    // the binary autofail criterion has weightPercent 0 → no "[weight: 0%]"
    expect(out).not.toContain("[weight: 0%]");
  });

  it("omits the context block entirely when no tunable fields are set", () => {
    const input = makeInput();
    input.scorecard.scoringPhilosophy = null;
    input.scorecard.bandDescriptors = null;
    input.scorecard.domainContext = null;
    input.scorecard.toneExpectations = null;
    const out = buildSystemPrompt(input);
    expect(out).not.toContain("Scoring philosophy:");
    expect(out).not.toContain("Likert-band descriptors:");
  });
});

describe("buildUserPrompt", () => {
  it("numbers messages by position and tags internal (non-public) ones", () => {
    const out = buildUserPrompt(makeInput());
    expect(out).toContain("Ticket id: tic_1");
    expect(out).toContain("Message 1 (id: msg_1, customer (Dana)):");
    // SVP-274: agent turns get a `[HUMAN]` / `[AI]` tag; null name + human
    // subtype renders bare `[HUMAN]`; isPublic:false still adds ` [internal]`.
    expect(out).toContain("Message 2 (id: msg_2, [HUMAN] [internal]):");
  });

  it("renders (none) when the ticket has no tags", () => {
    const input = makeInput();
    input.ticket.tags = [];
    expect(buildUserPrompt(input)).toContain("Tags: (none)");
  });

  it("tags agent turns by authorSubtype: [HUMAN: name] and [AI: name]", () => {
    const input = makeInput({
      messages: [
        {
          id: "m1",
          authorRole: "customer",
          authorName: "Dana",
          authorSubtype: null,
          body: "Where is my refund?",
          isPublic: true,
          createdAt: new Date("2026-01-01T00:00:00Z"),
        },
        {
          id: "m2",
          authorRole: "agent",
          authorName: "Maya",
          authorSubtype: "human",
          body: "Looking now.",
          isPublic: true,
          createdAt: new Date("2026-01-01T01:00:00Z"),
        },
        {
          id: "m3",
          authorRole: "agent",
          authorName: "Fin",
          authorSubtype: "bot",
          body: "Your order #ABC-123 shipped yesterday.",
          isPublic: true,
          createdAt: new Date("2026-01-01T02:00:00Z"),
        },
      ],
    });
    const out = buildUserPrompt(input);
    expect(out).toContain("customer (Dana)");
    expect(out).toContain("[HUMAN: Maya]");
    expect(out).toContain("[AI: Fin]");
  });
});

describe("target instruction in system prompt", () => {
  it("target=human → scores only HUMAN-tagged turns", () => {
    const out = buildSystemPrompt(makeInput({ target: "human" }));
    expect(out).toContain("Score only the HUMAN-tagged agent turns");
    expect(out).not.toContain("Score only the AI-tagged");
    expect(out).not.toContain("customer outcome");
  });

  it("target=ai → scores only AI-tagged turns", () => {
    const out = buildSystemPrompt(makeInput({ target: "ai" }));
    expect(out).toContain("Score only the AI-tagged agent turns");
    expect(out).not.toContain("Score only the HUMAN-tagged");
  });

  it("target=resolution → scores the customer outcome", () => {
    const out = buildSystemPrompt(makeInput({ target: "resolution" }));
    expect(out).toContain("customer outcome");
    expect(out).toContain("both are responsible for the outcome");
    expect(out).not.toContain("Score only the HUMAN-tagged");
    expect(out).not.toContain("Score only the AI-tagged");
  });
});

describe("buildToolSchema", () => {
  it("constrains categoryId to the exact set of category ids", () => {
    const schema = buildToolSchema(makeInput().scorecard.categories);
    const enumVals =
      schema.properties.categoryScores.items.properties.categoryId.enum;
    expect(enumVals).toEqual(["cat_empathy", "cat_compliance"]);
  });

  it("caps highlightedMessageIds at 3", () => {
    const schema = buildToolSchema(makeInput().scorecard.categories);
    expect(
      schema.properties.categoryScores.items.properties.highlightedMessageIds
        .maxItems,
    ).toBe(3);
  });
});
