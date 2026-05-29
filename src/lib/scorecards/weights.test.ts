import { describe, expect, it } from "vitest";
import { validateWeights, type WeightInput } from "./weights";

function happyIqs(): WeightInput {
  return {
    categories: [
      {
        name: "Customer Connection",
        weightPercent: 35,
        isAutofail: false,
        criteria: [{ text: "c1", weightPercent: 35 }],
      },
      {
        name: "Resolution Quality",
        weightPercent: 30,
        isAutofail: false,
        criteria: [{ text: "c2", weightPercent: 30 }],
      },
      {
        name: "Communication",
        weightPercent: 15,
        isAutofail: false,
        criteria: [{ text: "c3", weightPercent: 15 }],
      },
      {
        name: "Process & Ownership",
        weightPercent: 20,
        isAutofail: false,
        criteria: [{ text: "c4", weightPercent: 20 }],
      },
      {
        name: "Compliance",
        weightPercent: 0,
        isAutofail: true,
        criteria: [{ text: "c5", weightPercent: 0 }],
      },
    ],
  };
}

function happyAprikot(): WeightInput {
  return {
    categories: [
      {
        name: "Connection",
        weightPercent: 50,
        isAutofail: false,
        criteria: [
          { text: "warmth", weightPercent: 30 },
          { text: "ack", weightPercent: 20 },
        ],
      },
      {
        name: "Resolution",
        weightPercent: 50,
        isAutofail: false,
        criteria: [
          { text: "correctness", weightPercent: 30 },
          { text: "completeness", weightPercent: 20 },
        ],
      },
    ],
  };
}

describe("validateWeights", () => {
  it("accepts a happy IQS payload (5 categories incl. 0-weight autofail)", () => {
    expect(() => validateWeights(happyIqs())).not.toThrow();
  });

  it("accepts a happy Aprikot payload (multi-criterion categories sum to 100)", () => {
    expect(() => validateWeights(happyAprikot())).not.toThrow();
  });

  it("rejects payloads whose non-autofail category weights don't sum to 100", () => {
    const card = happyIqs();
    card.categories[0].weightPercent = 30; // breaks the sum (30+30+15+20 = 95)
    card.categories[0].criteria[0].weightPercent = 30;
    expect(() => validateWeights(card)).toThrow(/sum to 100/);
  });

  it("rejects an autofail category with a non-zero weightPercent", () => {
    const card = happyIqs();
    // Non-autofail categories already sum to 100; lifting the autofail's
    // weight from 0 → 5 isolates the autofail rule as the only violation.
    const compliance = card.categories[card.categories.length - 1];
    compliance.weightPercent = 5;
    expect(() => validateWeights(card)).toThrow(/must have weight 0/);
  });

  it("rejects a payload that mixes explicit and omitted criterion weights in one category", () => {
    const card = happyAprikot();
    // First criterion still carries an explicit weight; second drops to omitted.
    card.categories[0].criteria[1] = { text: "ack" };
    expect(() => validateWeights(card)).toThrow(
      /mixes explicit and omitted/,
    );
  });

  it("rejects when criterion weights inside a category don't sum to the category weight", () => {
    const card = happyAprikot();
    // 30 + 25 = 55 ≠ category weight 50
    card.categories[0].criteria[1].weightPercent = 25;
    expect(() => validateWeights(card)).toThrow(/sum to 55/);
  });
});
