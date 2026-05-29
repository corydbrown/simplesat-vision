import { describe, expect, test } from "vitest";
import { providerLabel } from "./provider-display";

describe("providerLabel", () => {
  test("returns em-dash for null / undefined / empty", () => {
    expect(providerLabel(null)).toBe("—");
    expect(providerLabel(undefined)).toBe("—");
    expect(providerLabel("")).toBe("—");
  });

  test("returns canonical label for known providers", () => {
    expect(providerLabel("intercom_fin")).toBe("Intercom Fin");
    expect(providerLabel("decagon")).toBe("Decagon");
    expect(providerLabel("anthropic_custom")).toBe("Anthropic (custom)");
  });

  test("humanizes unknown providers by title-casing snake_case", () => {
    expect(providerLabel("new_vendor")).toBe("New Vendor");
    expect(providerLabel("solo")).toBe("Solo");
  });
});
