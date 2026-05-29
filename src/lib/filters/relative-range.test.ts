import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { relativeRangeMs } from "./relative-range";
import type { RelativeValue } from "./types";

describe("relativeRangeMs", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("'this day' returns midnight → midnight - 1ms on the current day", () => {
    vi.setSystemTime(new Date("2026-05-15T14:32:00"));
    const r = relativeRangeMs({ n: 0, unit: "days", dir: "this" });
    expect(r).not.toBeNull();
    const start = new Date(r!.start);
    const end = new Date(r!.end);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    // 24h - 1ms window.
    expect(r!.end - r!.start).toBe(24 * 60 * 60 * 1000 - 1);
    // start and end share the same calendar day.
    expect(start.getDate()).toBe(end.getDate());
  });

  it("'this week' returns Sun 00:00 → next Sun 00:00 - 1ms", () => {
    // 2026-05-15 is a Friday. Sunday before is 2026-05-10.
    vi.setSystemTime(new Date("2026-05-15T09:00:00"));
    const r = relativeRangeMs({ n: 0, unit: "weeks", dir: "this" });
    expect(r).not.toBeNull();
    const start = new Date(r!.start);
    expect(start.getDay()).toBe(0); // Sunday
    expect(start.getDate()).toBe(10);
    expect(r!.end - r!.start).toBe(7 * 24 * 60 * 60 * 1000 - 1);
  });

  it("'this month' spans the first of the month → last ms of the month", () => {
    vi.setSystemTime(new Date("2026-05-15T09:00:00"));
    const r = relativeRangeMs({ n: 0, unit: "months", dir: "this" });
    expect(r).not.toBeNull();
    const start = new Date(r!.start);
    const end = new Date(r!.end);
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(4); // May
    // End is one ms before June 1.
    expect(end.getMonth()).toBe(4);
    expect(end.getDate()).toBe(31);
  });

  it("'past N days' is a closed window [now - N*24h, now]", () => {
    const now = new Date("2026-05-15T12:00:00Z");
    vi.setSystemTime(now);
    const r = relativeRangeMs({ n: 7, unit: "days", dir: "past" });
    expect(r).not.toBeNull();
    expect(r!.end).toBe(now.getTime());
    expect(r!.end - r!.start).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("'next N weeks' starts at now and extends N*7 days forward", () => {
    const now = new Date("2026-05-15T12:00:00Z");
    vi.setSystemTime(now);
    const r = relativeRangeMs({ n: 2, unit: "weeks", dir: "next" });
    expect(r).not.toBeNull();
    expect(r!.start).toBe(now.getTime());
    expect(r!.end - r!.start).toBe(2 * 7 * 24 * 60 * 60 * 1000);
  });

  it("'this month' in a leap-year February covers Feb 1 → Feb 29", () => {
    // 2024 is a leap year; pick mid-Feb.
    vi.setSystemTime(new Date("2024-02-14T08:00:00"));
    const r = relativeRangeMs({ n: 0, unit: "months", dir: "this" });
    expect(r).not.toBeNull();
    const start = new Date(r!.start);
    const end = new Date(r!.end);
    expect(start.getMonth()).toBe(1);
    expect(start.getDate()).toBe(1);
    expect(end.getMonth()).toBe(1);
    expect(end.getDate()).toBe(29); // leap-day landing
  });

  it("DST transition: 'past 7 days' still spans exactly 7 * 24h regardless of clock shifts", () => {
    // The implementation uses a flat unitMs (24h). DST shifts the wall clock
    // but not the millisecond delta — verify the contract.
    vi.setSystemTime(new Date("2026-03-09T12:00:00")); // 1 day after US DST begins
    const r = relativeRangeMs({ n: 7, unit: "days", dir: "past" });
    expect(r).not.toBeNull();
    expect(r!.end - r!.start).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("returns null for an unrecognized unit on a 'this' relative value", () => {
    vi.setSystemTime(new Date("2026-05-15T12:00:00"));
    // RelativeValue's TS type rules out "years", but the runtime must still
    // return null (defensive — protects against corrupt URL state).
    const r = relativeRangeMs({
      n: 0,
      unit: "years" as RelativeValue["unit"],
      dir: "this",
    });
    expect(r).toBeNull();
  });
});
