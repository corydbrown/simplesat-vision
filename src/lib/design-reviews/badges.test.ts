import { describe, expect, it } from "vitest";
import {
  EFFORT_BADGE_CLASS,
  priorityClass,
  severityClass,
  severityRank,
} from "./badges";
import type { Priority, Severity } from "./types";

const SEVERITIES: Severity[] = ["low", "medium", "high", "critical"];
const PRIORITIES: Priority[] = ["P1", "P2", "P3"];

describe("severityClass", () => {
  it("returns a production-hue token pair for every severity", () => {
    for (const s of SEVERITIES) {
      expect(severityClass(s)).toMatch(/^bg-\w+-\w+ text-\w+-\w+$/);
    }
  });

  it("never emits a raw Tailwind hue or the non-existent -default shade", () => {
    for (const s of SEVERITIES) {
      const cls = severityClass(s);
      expect(cls).not.toMatch(/-\d{2,3}\b/); // bg-red-50 etc.
      expect(cls).not.toContain("-default");
    }
  });
});

describe("priorityClass", () => {
  it("returns a distinct token pair per priority", () => {
    const seen = new Set(PRIORITIES.map(priorityClass));
    expect(seen.size).toBe(PRIORITIES.length);
  });

  it("never emits -default", () => {
    for (const p of PRIORITIES) expect(priorityClass(p)).not.toContain("-default");
  });
});

describe("EFFORT_BADGE_CLASS", () => {
  it("is a production-hue token pair, no raw hue or -default", () => {
    expect(EFFORT_BADGE_CLASS).toMatch(/^bg-\w+-\w+ text-\w+-\w+$/);
    expect(EFFORT_BADGE_CLASS).not.toMatch(/-\d{2,3}\b/);
    expect(EFFORT_BADGE_CLASS).not.toContain("-default");
  });
});

describe("severityRank", () => {
  it("orders critical worst → low best", () => {
    const sorted = [...SEVERITIES].sort((a, b) => severityRank(a) - severityRank(b));
    expect(sorted).toEqual(["critical", "high", "medium", "low"]);
  });
});
