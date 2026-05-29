import { describe, expect, it } from "vitest";

import { resolveProviderFromAuthor } from "./ai-detection";

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
