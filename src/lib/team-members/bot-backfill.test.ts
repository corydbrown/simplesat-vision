import { describe, expect, it } from "vitest";

import { planBotBackfill, type BotMessageRow } from "./bot-backfill";

describe("planBotBackfill", () => {
  it("returns no plans for an empty candidate set", () => {
    expect(planBotBackfill([])).toEqual([]);
  });

  it("groups bot messages by workspace with correct per-workspace counts", () => {
    const rows: BotMessageRow[] = [
      { id: "tkm_1", workspaceId: "wks_simplesat" },
      { id: "tkm_2", workspaceId: "wks_pronto" },
      { id: "tkm_3", workspaceId: "wks_simplesat" },
      { id: "tkm_4", workspaceId: "wks_simplesat" },
    ];

    const plans = planBotBackfill(rows);

    // First-seen workspace order; counts (= the dry-run count) are exact.
    expect(plans).toEqual([
      {
        workspaceId: "wks_simplesat",
        provider: "intercom_fin",
        messageIds: ["tkm_1", "tkm_3", "tkm_4"],
      },
      {
        workspaceId: "wks_pronto",
        provider: "intercom_fin",
        messageIds: ["tkm_2"],
      },
    ]);
    expect(plans[0].messageIds).toHaveLength(3);
    expect(plans[1].messageIds).toHaveLength(1);
  });

  it("attributes every workspace to intercom_fin", () => {
    const plans = planBotBackfill([
      { id: "tkm_a", workspaceId: "wks_a" },
      { id: "tkm_b", workspaceId: "wks_b" },
    ]);
    expect(plans.every((p) => p.provider === "intercom_fin")).toBe(true);
  });

  it("preserves input message-id order within a workspace", () => {
    const plans = planBotBackfill([
      { id: "tkm_z", workspaceId: "wks" },
      { id: "tkm_a", workspaceId: "wks" },
      { id: "tkm_m", workspaceId: "wks" },
    ]);
    expect(plans[0].messageIds).toEqual(["tkm_z", "tkm_a", "tkm_m"]);
  });
});
