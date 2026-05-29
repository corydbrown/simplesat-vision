import { describe, expect, it } from "vitest";
import { estimateCostCents } from "./pricing";

describe("estimateCostCents", () => {
  const now = new Date("2026-05-28T00:00:00Z");

  it("computes basic input + output cents for a known model", () => {
    // claude-sonnet-4-6: $3 / 1M input, $15 / 1M output
    // 1M input + 1M output = $3 + $15 = $18 = 1800 cents
    const cents = estimateCostCents(
      "anthropic",
      "claude-sonnet-4-6",
      1_000_000,
      1_000_000,
      now,
    );
    expect(cents).toBe(1800);
  });

  it("rounds sub-cent values to the nearest integer cent", () => {
    // claude-haiku-4-5: $1 / 1M input, $5 / 1M output
    // 100 input + 100 output = (100 * 1 + 100 * 5) / 1M = $0.0006 = 0.06 cents
    // → rounds to 0
    expect(
      estimateCostCents("anthropic", "claude-haiku-4-5", 100, 100, now),
    ).toBe(0);
    // 5000 input + 5000 output = $0.03 = 3 cents
    expect(
      estimateCostCents("anthropic", "claude-haiku-4-5", 5000, 5000, now),
    ).toBe(3);
  });

  it("returns integer cents (never a float)", () => {
    const cents = estimateCostCents(
      "anthropic",
      "claude-opus-4-7",
      123_456,
      78_910,
      now,
    );
    expect(cents).not.toBeNull();
    expect(Number.isInteger(cents)).toBe(true);
  });

  it("respects effectiveFrom — entries with future effectiveFrom are skipped", () => {
    const before = new Date("2025-12-31T00:00:00Z");
    // All current entries have effectiveFrom 2026-01-01, so a 2025 lookup
    // finds no active price entry and must return null.
    expect(
      estimateCostCents(
        "anthropic",
        "claude-sonnet-4-6",
        1_000_000,
        1_000_000,
        before,
      ),
    ).toBeNull();
  });

  it("returns null for unknown (provider, model) or non-finite tokens", () => {
    expect(
      estimateCostCents("openai", "gpt-4o", 1000, 1000, now),
    ).toBeNull();
    expect(
      estimateCostCents("anthropic", "claude-opus-4-7", NaN, 1000, now),
    ).toBeNull();
    expect(
      estimateCostCents("anthropic", "claude-opus-4-7", 1000, Infinity, now),
    ).toBeNull();
  });
});
