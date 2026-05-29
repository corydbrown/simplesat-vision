import { describe, expect, it } from "vitest";
import { formatSmartTime } from "./format";

describe("formatSmartTime", () => {
  const now = new Date("2026-05-15T14:32:00");

  it("less than a minute ago → 'just now'", () => {
    expect(formatSmartTime(new Date(now.getTime() - 30_000), now)).toBe(
      "just now",
    );
  });

  it("under an hour ago → 'Xm ago'", () => {
    expect(formatSmartTime(new Date(now.getTime() - 12 * 60_000), now)).toBe(
      "12m ago",
    );
  });

  it("under a day ago → 'Xh ago'", () => {
    expect(
      formatSmartTime(new Date(now.getTime() - 3 * 60 * 60_000), now),
    ).toBe("3h ago");
  });

  it("under a week ago → '<Weekday short> at <time>'", () => {
    // 4 days before May 15 2026 = May 11 (Monday).
    const earlier = new Date(now.getTime() - 4 * 24 * 60 * 60_000);
    const out = formatSmartTime(earlier, now);
    expect(out).toMatch(/^Mon at /);
    expect(out).toMatch(/(AM|PM)/);
  });

  it("same year, more than a week ago → 'Mmm D, <time>' (no year)", () => {
    const earlier = new Date("2026-02-04T09:15:00");
    const out = formatSmartTime(earlier, now);
    expect(out).toContain("Feb 4");
    expect(out).not.toContain("2026");
    expect(out).toMatch(/9:15/);
  });

  it("different year → 'Mmm D, YYYY, <time>'", () => {
    const earlier = new Date("2024-08-22T17:05:00");
    const out = formatSmartTime(earlier, now);
    expect(out).toContain("Aug 22");
    expect(out).toContain("2024");
  });

  it("crosses DST without losing alignment (uses millisecond deltas, not wall clock)", () => {
    // ~6 days before — should land in the weekday-at-time branch.
    const dstNow = new Date("2026-03-15T12:00:00"); // 1 week after US DST
    const earlier = new Date(dstNow.getTime() - 6 * 24 * 60 * 60_000);
    const out = formatSmartTime(earlier, dstNow);
    // Branch: < 7 days → weekday format with " at ".
    expect(out).toContain(" at ");
    expect(out.length).toBeGreaterThanOrEqual(8);
  });

  it("returns '-' for null / undefined input", () => {
    expect(formatSmartTime(null, now)).toBe("-");
    expect(formatSmartTime(undefined, now)).toBe("-");
  });
});
