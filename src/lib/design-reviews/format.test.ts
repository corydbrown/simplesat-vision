import { describe, expect, it } from "vitest";
import { formatReviewDate } from "./format";

describe("formatReviewDate", () => {
  it("formats a date-only ISO string in UTC", () => {
    expect(formatReviewDate("2026-05-29")).toBe("May 29, 2026");
  });

  it("does not shift the day (UTC-pinned)", () => {
    // Jan 1 must stay Jan 1 regardless of the host time zone.
    expect(formatReviewDate("2026-01-01")).toBe("January 1, 2026");
  });

  it("returns the input unchanged when it is not a valid YYYY-MM-DD", () => {
    expect(formatReviewDate("not-a-date")).toBe("not-a-date");
  });
});
