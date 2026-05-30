import { describe, expect, it } from "vitest";
import { buildMessageMentionSource } from "./message-source";
import type { CoachingMessageView } from "@/db/queries/coaching";

function msg(over: Partial<CoachingMessageView>): CoachingMessageView {
  return {
    id: "tkm_x",
    authorRole: "agent",
    authorSubtype: "human",
    authorName: "Sim",
    authorId: "u_1",
    authorAvatarColor: null,
    channel: "chat",
    isPublic: true,
    type: "reply",
    body: "Hello there",
    createdAt: 0,
    ...over,
  } as CoachingMessageView;
}

describe("buildMessageMentionSource", () => {
  it("numbers messages 1-based and tokens them as 'Message N'", () => {
    const src = buildMessageMentionSource([
      msg({ id: "a" }),
      msg({ id: "b" }),
    ]);
    expect(src.trigger).toBe("@");
    expect(src.items.map((i) => i.token)).toEqual(["Message 1", "Message 2"]);
    expect(src.items.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("puts author + snippet in the description and body in keywords", () => {
    const src = buildMessageMentionSource([
      msg({ authorName: "Dana", body: "Can I get a refund please" }),
    ]);
    expect(src.items[0].description).toBe('Dana · "Can I get a refund please"');
    expect(src.items[0].keywords).toContain("refund");
  });

  it("truncates long bodies in the description but not keywords", () => {
    const long = "x".repeat(200);
    const src = buildMessageMentionSource([msg({ body: long })]);
    expect(src.items[0].description!.length).toBeLessThan(90);
    expect(src.items[0].description).toContain("…");
    expect(src.items[0].keywords).toContain(long);
  });

  it("falls back to role label when authorName is blank", () => {
    const src = buildMessageMentionSource([
      msg({ authorName: "  ", authorRole: "customer" }),
    ]);
    expect(src.items[0].description).toMatch(/^customer · /);
  });
});
