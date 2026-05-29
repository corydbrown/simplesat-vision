import { describe, expect, it } from "vitest";
import { parseMessageRefs } from "./parse-message-refs";

describe("parseMessageRefs", () => {
  it("returns a single text segment when no refs", () => {
    expect(parseMessageRefs("agent was prompt and helpful")).toEqual([
      { kind: "text", text: "agent was prompt and helpful" },
    ]);
  });

  it("returns empty array on empty input", () => {
    expect(parseMessageRefs("")).toEqual([]);
  });

  it("parses a single ref with surrounding text", () => {
    expect(parseMessageRefs("see Message 3 for details")).toEqual([
      { kind: "text", text: "see " },
      { kind: "mention", number: 3 },
      { kind: "text", text: " for details" },
    ]);
  });

  it("parses multiple refs interleaved with prose", () => {
    expect(
      parseMessageRefs("Empathy shown in Message 2. Resolution in Message 5 closes."),
    ).toEqual([
      { kind: "text", text: "Empathy shown in " },
      { kind: "mention", number: 2 },
      { kind: "text", text: ". Resolution in " },
      { kind: "mention", number: 5 },
      { kind: "text", text: " closes." },
    ]);
  });

  it("does not treat trailing punctuation as part of the ref", () => {
    expect(parseMessageRefs("Cited (Message 7).")).toEqual([
      { kind: "text", text: "Cited (" },
      { kind: "mention", number: 7 },
      { kind: "text", text: ")." },
    ]);
  });

  it("distinguishes 'Message 10' from 'Message 1'", () => {
    expect(parseMessageRefs("Message 10 and Message 1 differ")).toEqual([
      { kind: "mention", number: 10 },
      { kind: "text", text: " and " },
      { kind: "mention", number: 1 },
      { kind: "text", text: " differ" },
    ]);
  });

  it("does not match 'Messages 3' (plural)", () => {
    expect(parseMessageRefs("see Messages 3 and 4")).toEqual([
      { kind: "text", text: "see Messages 3 and 4" },
    ]);
  });

  it("does not match within a longer word (e.g. 'MessageBoard 3')", () => {
    expect(parseMessageRefs("MessageBoard 3 was fine")).toEqual([
      { kind: "text", text: "MessageBoard 3 was fine" },
    ]);
  });

  it("does not match lowercase 'message N'", () => {
    expect(parseMessageRefs("the message 3 reply")).toEqual([
      { kind: "text", text: "the message 3 reply" },
    ]);
  });

  it("does not match 'Message 3a' (digit not at word boundary)", () => {
    expect(parseMessageRefs("section Message 3a here")).toEqual([
      { kind: "text", text: "section Message 3a here" },
    ]);
  });

  it("parses a ref at the very start and very end of the text", () => {
    expect(parseMessageRefs("Message 1 mid Message 9")).toEqual([
      { kind: "mention", number: 1 },
      { kind: "text", text: " mid " },
      { kind: "mention", number: 9 },
    ]);
  });

  it("emits out-of-range numbers as mentions — the renderer decides how to display", () => {
    expect(parseMessageRefs("see Message 999 below")).toEqual([
      { kind: "text", text: "see " },
      { kind: "mention", number: 999 },
      { kind: "text", text: " below" },
    ]);
  });
});
