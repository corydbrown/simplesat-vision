import { describe, expect, it } from "vitest";
import { computeOverallScore } from "./mock-provider";
import type {
  ScoringCategoryResult,
  ScoringScorecard,
} from "./types";

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

describe("computeOverallScore (mock provider)", () => {
  it("returns 100 when every non-autofail category is at the top of likert", () => {
    const overall = computeOverallScore({
      scorecard: IQS,
      categoryScores: results({
        connection: 5,
        resolution: 5,
        communication: 5,
        process: 5,
        compliance: 1,
      }),
      autoFailTriggered: false,
    });
    expect(overall).toBe(100);
  });

  it("computes a weighted average across IQS categories", () => {
    // Likert 5 → 100, 4 → 75, 3 → 50, 2 → 25, 1 → 0
    // Weighted: 35*100 + 30*75 + 15*50 + 20*25 = 3500+2250+750+500 = 7000 / 100 = 70
    const overall = computeOverallScore({
      scorecard: IQS,
      categoryScores: results({
        connection: 5,
        resolution: 4,
        communication: 3,
        process: 2,
        compliance: 1,
      }),
      autoFailTriggered: false,
    });
    expect(overall).toBe(70);
  });

  it("floors overall to the scorecard autoFailFloor when autoFailTriggered", () => {
    const overall = computeOverallScore({
      scorecard: IQS,
      categoryScores: results({
        connection: 5,
        resolution: 5,
        communication: 5,
        process: 5,
        compliance: 0,
      }),
      autoFailTriggered: true,
    });
    expect(overall).toBe(IQS.autoFailFloor);
  });

  it("ignores autofail categories in the weight sum (weight 0 contributes nothing)", () => {
    // Identical category likert scores, with vs without compliance present.
    const withCompliance = computeOverallScore({
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
    const withoutCompliance = computeOverallScore({
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

  it("skips categories with no matching result (missing category contributes nothing)", () => {
    // Only "connection" has a result; the remaining categories are dropped from
    // the weight sum, so connection alone defines the overall.
    const overall = computeOverallScore({
      scorecard: IQS,
      categoryScores: results({ connection: 3 }),
      autoFailTriggered: false,
    });
    // connection alone: 35 weight, likert 3 → 50 projected. 50.
    expect(overall).toBe(50);
  });

  it("handles single-criterion IQS (legacy byte-equivalence shape)", () => {
    // Pre-SVP-228 the formula was category-weight * projected. Today each IQS
    // category still has exactly one criterion whose weightPercent equals the
    // category weightPercent, so the two formulas land on the same integer.
    const overall = computeOverallScore({
      scorecard: IQS,
      categoryScores: results({
        connection: 4,
        resolution: 3,
        communication: 5,
        process: 2,
        compliance: 1,
      }),
      autoFailTriggered: false,
    });
    // Manual: 35*75 + 30*50 + 15*100 + 20*25 = 2625+1500+1500+500 = 6125 / 100 = 61.25 → 61
    expect(overall).toBe(61);
  });

  it("handles multi-criterion Aprikot (per-criterion weights drive the average)", () => {
    // All 5s → 100 regardless of per-criterion split.
    const allFive = computeOverallScore({
      scorecard: APRIKOT,
      categoryScores: results({ connection: 5, resolution: 5 }),
      autoFailTriggered: false,
    });
    expect(allFive).toBe(100);
    // connection=4 (75), resolution=2 (25): 50*75 + 50*25 = 5000 / 100 = 50.
    const mixed = computeOverallScore({
      scorecard: APRIKOT,
      categoryScores: results({ connection: 4, resolution: 2 }),
      autoFailTriggered: false,
    });
    expect(mixed).toBe(50);
  });

  it("is deterministic — same inputs produce the same output (byte-stable)", () => {
    const input = {
      scorecard: IQS,
      categoryScores: results({
        connection: 4,
        resolution: 3,
        communication: 5,
        process: 2,
        compliance: 1,
      }),
      autoFailTriggered: false,
    };
    const a = computeOverallScore(input);
    const b = computeOverallScore(input);
    const c = computeOverallScore(input);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});
