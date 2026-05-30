import { describe, expect, it } from "vitest";
import {
  applyMention,
  filterMentions,
  findActiveTrigger,
} from "./mention-query";
import type { MentionItem } from "./types";

const TRIGGERS = ["@", "/"] as const;

describe("findActiveTrigger", () => {
  it("opens when the caret follows a trigger at the start of the text", () => {
    expect(findActiveTrigger("@", 1, TRIGGERS)).toEqual({
      trigger: "@",
      query: "",
      start: 0,
    });
  });

  it("captures the query typed after the trigger", () => {
    const v = "see @mes";
    expect(findActiveTrigger(v, v.length, TRIGGERS)).toEqual({
      trigger: "@",
      query: "mes",
      start: 4,
    });
  });

  it("opens after a trigger preceded by whitespace", () => {
    const v = "the bot in @3";
    expect(findActiveTrigger(v, v.length, TRIGGERS)).toEqual({
      trigger: "@",
      query: "3",
      start: 11,
    });
  });

  it("does NOT open for a trigger glued to a word (email)", () => {
    const v = "foo@bar";
    expect(findActiveTrigger(v, v.length, TRIGGERS)).toBeNull();
  });

  it("does NOT open for a trigger glued to a word (path slash)", () => {
    const v = "src/lib";
    expect(findActiveTrigger(v, v.length, TRIGGERS)).toBeNull();
  });

  it("closes once a space is typed after the query", () => {
    const v = "@mes ";
    expect(findActiveTrigger(v, v.length, TRIGGERS)).toBeNull();
  });

  it("respects caret position, not end of string", () => {
    // caret sits right after "@me", before the rest
    const v = "@message later";
    expect(findActiveTrigger(v, 3, TRIGGERS)).toEqual({
      trigger: "@",
      query: "me",
      start: 0,
    });
  });

  it("routes by trigger char", () => {
    expect(findActiveTrigger("/cmd", 4, TRIGGERS)?.trigger).toBe("/");
  });

  it("only honors provided triggers", () => {
    expect(findActiveTrigger("@x", 2, ["/"])).toBeNull();
  });

  it("returns null with no trigger present", () => {
    expect(findActiveTrigger("plain text", 10, TRIGGERS)).toBeNull();
  });
});

describe("filterMentions", () => {
  const items: MentionItem[] = [
    { id: "1", token: "Message 1", label: "Message 1", keywords: "hello there" },
    { id: "2", token: "Message 2", label: "Message 2", keywords: "refund please" },
    { id: "12", token: "Message 12", label: "Message 12", keywords: "thanks" },
  ];

  it("returns all items for an empty query", () => {
    expect(filterMentions(items, "")).toHaveLength(3);
  });

  it("returns a copy, not the original array", () => {
    expect(filterMentions(items, "")).not.toBe(items);
  });

  it("matches on label substring", () => {
    expect(filterMentions(items, "2").map((i) => i.id)).toEqual(["2", "12"]);
  });

  it("matches on keywords when label misses", () => {
    expect(filterMentions(items, "refund").map((i) => i.id)).toEqual(["2"]);
  });

  it("ranks label-prefix above keyword hits", () => {
    const mixed: MentionItem[] = [
      { id: "a", token: "a", label: "Other", keywords: "message" },
      { id: "b", token: "b", label: "Message 9", keywords: "" },
    ];
    expect(filterMentions(mixed, "message").map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("is case-insensitive", () => {
    expect(filterMentions(items, "MESSAGE")).toHaveLength(3);
  });

  it("returns nothing when no item matches", () => {
    expect(filterMentions(items, "zzz")).toEqual([]);
  });
});

describe("applyMention", () => {
  it("replaces the trigger range with token + trailing space", () => {
    const v = "the bot in @3";
    const active = findActiveTrigger(v, v.length, TRIGGERS)!;
    expect(applyMention(v, active, v.length, "Message 3")).toEqual({
      value: "the bot in Message 3 ",
      caret: "the bot in Message 3 ".length,
    });
  });

  it("preserves text after the caret", () => {
    const v = "@me and more";
    // caret right after "@me"
    const active = findActiveTrigger(v, 3, TRIGGERS)!;
    expect(applyMention(v, active, 3, "Message 1")).toEqual({
      value: "Message 1  and more",
      caret: "Message 1 ".length,
    });
  });
});
