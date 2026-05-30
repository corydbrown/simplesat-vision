import { describe, expect, it } from "vitest";

import {
  pickAiTeamMemberName,
  resolveBotProviderForMessage,
  resolveProviderFromAuthor,
  rowMatchesVendor,
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

describe("rowMatchesVendor (SVP-281)", () => {
  const intercomPatterns = {
    email: "operator+%@intercom.io",
    externalId: "operator+%@intercom.io",
  };

  it("matches a helpdesk-synced Sim row via email", () => {
    expect(
      rowMatchesVendor(
        { email: "operator+xyz@intercom.io", externalId: null },
        intercomPatterns,
      ),
    ).toBe(true);
  });

  it("matches via external_id when n8n routed the operator string there", () => {
    expect(
      rowMatchesVendor(
        { email: "sim@example.com", externalId: "operator+abc@intercom.io" },
        intercomPatterns,
      ),
    ).toBe(true);
  });

  it("matches case-insensitively (Intercom may emit mixed-case suffixes)", () => {
    expect(
      rowMatchesVendor(
        { email: "Operator+WS123@Intercom.IO", externalId: null },
        intercomPatterns,
      ),
    ).toBe(true);
  });

  it("does not match a legitimate human's email", () => {
    expect(
      rowMatchesVendor(
        { email: "human@example.com", externalId: "12345" },
        intercomPatterns,
      ),
    ).toBe(false);
  });

  it("does not match when email/external_id are both null", () => {
    expect(rowMatchesVendor({ email: null, externalId: null }, intercomPatterns)).toBe(
      false,
    );
  });

  it("does not match when the provider has no pattern (e.g. decagon)", () => {
    expect(
      rowMatchesVendor(
        { email: "anything@example.com", externalId: null },
        undefined,
      ),
    ).toBe(false);
  });

  it("does not over-match a near-shape that isn't quite the pattern", () => {
    // Missing the `operator+` prefix → not a Fin admin.
    expect(
      rowMatchesVendor(
        { email: "admin+xyz@intercom.io", externalId: null },
        intercomPatterns,
      ),
    ).toBe(false);
    // Wrong domain.
    expect(
      rowMatchesVendor(
        { email: "operator+xyz@example.io", externalId: null },
        intercomPatterns,
      ),
    ).toBe(false);
  });
});

describe("pickAiTeamMemberName (SVP-281)", () => {
  it("returns the caller name when present (path 1 — payload)", () => {
    expect(
      pickAiTeamMemberName({
        callerName: "Sim",
        upgradeFromName: "Should not win",
        providerDefault: "Fin",
      }),
    ).toBe("Sim");
  });

  it("returns the upgrade-from name when no caller name (path 2 — preserve existing)", () => {
    expect(
      pickAiTeamMemberName({
        upgradeFromName: "Sim",
        providerDefault: "Fin",
      }),
    ).toBe("Sim");
  });

  it("returns the provider default when neither caller nor upgrade name is set (path 3)", () => {
    expect(pickAiTeamMemberName({ providerDefault: "Fin" })).toBe("Fin");
  });

  it("treats a whitespace-only caller name as absent and falls through", () => {
    expect(
      pickAiTeamMemberName({
        callerName: "   ",
        upgradeFromName: "Sim",
        providerDefault: "Fin",
      }),
    ).toBe("Sim");
    expect(
      pickAiTeamMemberName({
        callerName: "",
        providerDefault: "Fin",
      }),
    ).toBe("Fin");
  });

  it("trims surrounding whitespace from a real caller name", () => {
    expect(
      pickAiTeamMemberName({
        callerName: "  Sim  ",
        providerDefault: "Fin",
      }),
    ).toBe("Sim");
  });
});
