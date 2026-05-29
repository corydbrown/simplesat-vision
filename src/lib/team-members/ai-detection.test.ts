import { describe, expect, it } from "vitest";

import {
  resolveBotProviderForMessage,
  resolveProviderFromAuthor,
} from "./ai-detection";

describe("resolveProviderFromAuthor", () => {
  it("detects Intercom Fin from author.type === 'bot'", () => {
    expect(
      resolveProviderFromAuthor({ type: "bot", id: "fin", name: "Fin" }),
    ).toBe("intercom_fin");
  });

  it("returns unknown for Intercom human admin author", () => {
    expect(resolveProviderFromAuthor({ type: "admin", id: "12345" })).toBe(
      "unknown",
    );
  });

  it("returns unknown for customer author", () => {
    expect(resolveProviderFromAuthor({ type: "user", id: "67890" })).toBe(
      "unknown",
    );
  });

  it("returns unknown for null / undefined / primitive payloads", () => {
    expect(resolveProviderFromAuthor(null)).toBe("unknown");
    expect(resolveProviderFromAuthor(undefined)).toBe("unknown");
    expect(resolveProviderFromAuthor("bot")).toBe("unknown");
    expect(resolveProviderFromAuthor(42)).toBe("unknown");
  });

  it("returns unknown for empty object", () => {
    expect(resolveProviderFromAuthor({})).toBe("unknown");
  });
});

describe("resolveBotProviderForMessage", () => {
  it("attributes an agent bot turn to intercom_fin", () => {
    expect(
      resolveBotProviderForMessage({
        authorRole: "agent",
        authorSubtype: "bot",
      }),
    ).toBe("intercom_fin");
  });

  it("returns null for a human agent turn", () => {
    expect(
      resolveBotProviderForMessage({
        authorRole: "agent",
        authorSubtype: "human",
      }),
    ).toBeNull();
  });

  it("returns null for an agent turn with no subtype (defaults to human)", () => {
    expect(resolveBotProviderForMessage({ authorRole: "agent" })).toBeNull();
    expect(
      resolveBotProviderForMessage({
        authorRole: "agent",
        authorSubtype: null,
      }),
    ).toBeNull();
  });

  it("returns null for customer and system turns", () => {
    expect(resolveBotProviderForMessage({ authorRole: "customer" })).toBeNull();
    expect(resolveBotProviderForMessage({ authorRole: "system" })).toBeNull();
    // A "bot" subtype only counts on an agent turn — a customer turn is never
    // a bot regardless of an (illegitimate) subtype.
    expect(
      resolveBotProviderForMessage({
        authorRole: "customer",
        authorSubtype: "bot",
      }),
    ).toBeNull();
  });
});
