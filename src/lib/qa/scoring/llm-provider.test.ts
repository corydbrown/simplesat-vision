import { describe, expect, it } from "vitest";
import { computeOverall } from "./llm-provider";
import type {
  ScoringCategoryResult,
  ScoringScorecard,
} from "./types";

// Same scorecard fixtures the mock-provider test uses, so any drift between
// the two compute paths surfaces as a test diff against the same shapes.
const IQS: ScoringScorecard = {
  id: "iqs",
  name: "IQS",
  version: 1,
  autoFailFloor: 30,
  scoringPhilosophy: null,
  bandDescriptors: null,
  domainContext: null,
  toneExpectations: null,
  categories: [
    {
      id: "connection",
      name: "Customer Connection",
      description: "",
      weightPercent: 35,
      scaleType: "likert_5",
      isAutofail: false,
      criteria: [{ id: "c-connection", text: "", weightPercent: 35 }],
    },
    {
      id: "resolution",
      name: "Resolution Quality",
      description: "",
      weightPercent: 30,
      scaleType: "likert_5",
      isAutofail: false,
      criteria: [{ id: "c-resolution", text: "", weightPercent: 30 }],
    },
    {
      id: "communication",
      name: "Communication",
      description: "",
      weightPercent: 15,
      scaleType: "likert_5",
      isAutofail: false,
      criteria: [{ id: "c-communication", text: "", weightPercent: 15 }],
    },
    {
      id: "process",
      name: "Process & Ownership",
      description: "",
      weightPercent: 20,
      scaleType: "likert_5",
      isAutofail: false,
      criteria: [{ id: "c-process", text: "", weightPercent: 20 }],
    },
    {
      id: "compliance",
      name: "Compliance & Safety",
      description: "",
      weightPercent: 0,
      scaleType: "binary",
      isAutofail: true,
      criteria: [{ id: "c-compliance", text: "", weightPercent: 0 }],
    },
  ],
};

const APRIKOT: ScoringScorecard = {
  id: "aprikot",
  name: "Aprikot",
  version: 1,
  autoFailFloor: 30,
  scoringPhilosophy: null,
  bandDescriptors: null,
  domainContext: null,
  toneExpectations: null,
  categories: [
    {
      id: "connection",
      name: "Connection",
      description: "",
      weightPercent: 50,
      scaleType: "likert_5",
      isAutofail: false,
      criteria: [
        { id: "c1", text: "warmth", weightPercent: 30 },
        { id: "c2", text: "acknowledgement", weightPercent: 20 },
      ],
    },
    {
      id: "resolution",
      name: "Resolution",
      description: "",
      weightPercent: 50,
      scaleType: "likert_5",
      isAutofail: false,
      criteria: [
        { id: "c3", text: "correctness", weightPercent: 30 },
        { id: "c4", text: "completeness", weightPercent: 20 },
      ],
    },
  ],
};

function results(byId: Record<string, number>): ScoringCategoryResult[] {
  return Object.entries(byId).map(([categoryId, aiScore]) => ({
    categoryId,
    aiScore,
    aiReasoning: "",
    highlightedMessageIds: [],
  }));
}

describe("computeOverall (LLM provider) — parallel test of mock-provider.computeOverallScore", () => {
  it("returns 100 when every non-autofail category is at the top of likert", () => {
    expect(
      computeOverall({
        scorecard: IQS,
        categoryScores: results({
          connection: 5,
          resolution: 5,
          communication: 5,
          process: 5,
          compliance: 1,
        }),
        autoFailTriggered: false,
      }),
    ).toBe(100);
  });

  it("computes a weighted average across IQS categories (same as mock)", () => {
    expect(
      computeOverall({
        scorecard: IQS,
        categoryScores: results({
          connection: 5,
          resolution: 4,
          communication: 3,
          process: 2,
          compliance: 1,
        }),
        autoFailTriggered: false,
      }),
    ).toBe(70);
  });

  it("floors overall to the scorecard autoFailFloor when autoFailTriggered", () => {
    expect(
      computeOverall({
        scorecard: IQS,
        categoryScores: results({
          connection: 5,
          resolution: 5,
          communication: 5,
          process: 5,
          compliance: 0,
        }),
        autoFailTriggered: true,
      }),
    ).toBe(IQS.autoFailFloor);
  });

  it("ignores autofail categories in the weight sum", () => {
    const withCompliance = computeOverall({
      scorecard: IQS,
      categoryScores: results({
        connection: 4,
        resolution: 4,
        communication: 4,
        process: 4,
        compliance: 1,
      }),
      autoFailTriggered: false,
    });
    const stripped: ScoringScorecard = {
      ...IQS,
      categories: IQS.categories.filter((c) => !c.isAutofail),
    };
    const withoutCompliance = computeOverall({
      scorecard: stripped,
      categoryScores: results({
        connection: 4,
        resolution: 4,
        communication: 4,
        process: 4,
      }),
      autoFailTriggered: false,
    });
    expect(withCompliance).toBe(withoutCompliance);
  });

  it("skips categories with no matching result", () => {
    expect(
      computeOverall({
        scorecard: IQS,
        categoryScores: results({ connection: 3 }),
        autoFailTriggered: false,
      }),
    ).toBe(50);
  });

  it("handles single-criterion IQS — byte-equivalent with the mock formula", () => {
    expect(
      computeOverall({
        scorecard: IQS,
        categoryScores: results({
          connection: 4,
          resolution: 3,
          communication: 5,
          process: 2,
          compliance: 1,
        }),
        autoFailTriggered: false,
      }),
    ).toBe(61);
  });

  it("handles multi-criterion Aprikot", () => {
    expect(
      computeOverall({
        scorecard: APRIKOT,
        categoryScores: results({ connection: 4, resolution: 2 }),
        autoFailTriggered: false,
      }),
    ).toBe(50);
  });

  it("supports three_state and binary scale projections (LLM-specific path)", () => {
    // three_state: 0→0, 1→50, 2→100. binary: 0→0, 1→100.
    // Source comment notes the mock provider hasn't grown three_state yet — this
    // is the drift the parallel tests catch.
    const card: ScoringScorecard = {
      id: "mixed",
      name: "Mixed",
      version: 1,
      autoFailFloor: 30,
      scoringPhilosophy: null,
      bandDescriptors: null,
      domainContext: null,
      toneExpectations: null,
      categories: [
        {
          id: "tri",
          name: "Tri",
          description: "",
          weightPercent: 60,
          scaleType: "three_state",
          isAutofail: false,
          criteria: [{ id: "ct", text: "", weightPercent: 60 }],
        },
        {
          id: "bin",
          name: "Bin",
          description: "",
          weightPercent: 40,
          scaleType: "binary",
          isAutofail: false,
          criteria: [{ id: "cb", text: "", weightPercent: 40 }],
        },
      ],
    };
    // tri=1 (50), bin=1 (100): 60*50 + 40*100 = 7000 / 100 = 70
    expect(
      computeOverall({
        scorecard: card,
        categoryScores: results({ tri: 1, bin: 1 }),
        autoFailTriggered: false,
      }),
    ).toBe(70);
  });
});
