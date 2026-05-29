import { describe, expect, it } from "vitest";
import {
  pickScorecardAssignments,
  type ActorSignature,
  type ScorecardAssignment,
} from "./pick-scorecards";
import type {
  AutoScoringRule,
  Scorecard,
  ScorecardAppliesTo,
} from "@/db/schema";
import type { Filter } from "@/lib/filters/types";

type ScorecardPick = Pick<Scorecard, "id" | "appliesTo">;
type RulePick = Pick<
  AutoScoringRule,
  "id" | "scorecardId" | "priority" | "filterPredicate"
>;

function sc(id: string, appliesTo: ScorecardAppliesTo): ScorecardPick {
  return { id, appliesTo };
}

function rule(
  id: string,
  scorecardId: string,
  priority = 100,
  filterPredicate: Filter[] = [],
): RulePick {
  return { id, scorecardId, priority, filterPredicate };
}

function rulesMap(rules: RulePick[]): Map<string, RulePick[]> {
  const m = new Map<string, RulePick[]>();
  for (const r of rules) {
    const list = m.get(r.scorecardId) ?? [];
    list.push(r);
    m.set(r.scorecardId, list);
  }
  return m;
}

const HUMAN_ONLY: ActorSignature = {
  hasHumanTurns: true,
  hasAiTurns: false,
  assignedHumanId: "tmh_jane",
  aiTeamMemberId: null,
};
const AI_ONLY: ActorSignature = {
  hasHumanTurns: false,
  hasAiTurns: true,
  assignedHumanId: null,
  aiTeamMemberId: "tma_fin",
};
const MIXED: ActorSignature = {
  hasHumanTurns: true,
  hasAiTurns: true,
  assignedHumanId: "tmh_jane",
  aiTeamMemberId: "tma_fin",
};
const AI_ONLY_PRE_1C: ActorSignature = {
  hasHumanTurns: false,
  hasAiTurns: true,
  assignedHumanId: null,
  aiTeamMemberId: null,
};
const UNASSIGNED_RESOLUTION_ONLY: ActorSignature = {
  hasHumanTurns: false,
  hasAiTurns: false,
  assignedHumanId: null,
  aiTeamMemberId: null,
};

const matchAll = () => true;
const matchNone = () => false;

function byScorecardId(a: ScorecardAssignment, b: ScorecardAssignment): number {
  return a.scorecardId.localeCompare(b.scorecardId);
}

describe("pickScorecardAssignments", () => {
  it("human-only ticket fans out Human + Resolution (no AI eval)", () => {
    const result = pickScorecardAssignments(
      HUMAN_ONLY,
      [sc("scd_human", "human"), sc("scd_res", "resolution")],
      rulesMap([]),
      matchAll,
    );
    expect(result.sort(byScorecardId)).toEqual([
      {
        scorecardId: "scd_human",
        appliesTo: "human",
        scoredTeamMemberId: "tmh_jane",
        autoScoringRuleId: null,
      },
      {
        scorecardId: "scd_res",
        appliesTo: "resolution",
        scoredTeamMemberId: null,
        autoScoringRuleId: null,
      },
    ]);
  });

  it("AI-only ticket fans out AI + Resolution (Human pruned)", () => {
    const result = pickScorecardAssignments(
      AI_ONLY,
      [
        sc("scd_human", "human"),
        sc("scd_ai", "ai"),
        sc("scd_res", "resolution"),
      ],
      rulesMap([]),
      matchAll,
    );
    expect(result.sort(byScorecardId)).toEqual([
      {
        scorecardId: "scd_ai",
        appliesTo: "ai",
        scoredTeamMemberId: "tma_fin",
        autoScoringRuleId: null,
      },
      {
        scorecardId: "scd_res",
        appliesTo: "resolution",
        scoredTeamMemberId: null,
        autoScoringRuleId: null,
      },
    ]);
  });

  it("mixed ticket fans out Human + AI + Resolution (3 evals)", () => {
    const result = pickScorecardAssignments(
      MIXED,
      [
        sc("scd_human", "human"),
        sc("scd_ai", "ai"),
        sc("scd_res", "resolution"),
      ],
      rulesMap([]),
      matchAll,
    );
    expect(result).toHaveLength(3);
    expect(result.find((a) => a.scorecardId === "scd_human")).toMatchObject({
      scoredTeamMemberId: "tmh_jane",
    });
    expect(result.find((a) => a.scorecardId === "scd_ai")).toMatchObject({
      scoredTeamMemberId: "tma_fin",
    });
    expect(result.find((a) => a.scorecardId === "scd_res")).toMatchObject({
      scoredTeamMemberId: null,
    });
  });

  it("pre-1c AI ticket persists NULL scored_team_member_id but still emits AI + Resolution evals", () => {
    const result = pickScorecardAssignments(
      AI_ONLY_PRE_1C,
      [sc("scd_ai", "ai"), sc("scd_res", "resolution")],
      rulesMap([]),
      matchAll,
    );
    expect(result.sort(byScorecardId)).toEqual([
      {
        scorecardId: "scd_ai",
        appliesTo: "ai",
        scoredTeamMemberId: null,
        autoScoringRuleId: null,
      },
      {
        scorecardId: "scd_res",
        appliesTo: "resolution",
        scoredTeamMemberId: null,
        autoScoringRuleId: null,
      },
    ]);
  });

  it("Resolution scorecard fires even when ticket has neither human nor AI turns", () => {
    const result = pickScorecardAssignments(
      UNASSIGNED_RESOLUTION_ONLY,
      [
        sc("scd_human", "human"),
        sc("scd_ai", "ai"),
        sc("scd_res", "resolution"),
      ],
      rulesMap([]),
      matchAll,
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      scorecardId: "scd_res",
      appliesTo: "resolution",
      scoredTeamMemberId: null,
    });
  });

  it("Human scorecard with assigned NULL still emits — caller decides to skip", () => {
    // Edge case: hasHumanTurns is true (legacy agent turn) but the ticket
    // got unassigned. The picker still emits the assignment so the engine's
    // precondition guard (the existing `ScoringPreconditionError`) is the
    // single source of "skip unassigned" — not split across two layers.
    const result = pickScorecardAssignments(
      {
        hasHumanTurns: true,
        hasAiTurns: false,
        assignedHumanId: null,
        aiTeamMemberId: null,
      },
      [sc("scd_human", "human")],
      rulesMap([]),
      matchAll,
    );
    expect(result).toEqual([
      {
        scorecardId: "scd_human",
        appliesTo: "human",
        scoredTeamMemberId: null,
        autoScoringRuleId: null,
      },
    ]);
  });

  it("rule attached when scorecard has a rule whose predicate matches", () => {
    const result = pickScorecardAssignments(
      HUMAN_ONLY,
      [sc("scd_human", "human")],
      rulesMap([rule("asr_iqs", "scd_human", 100, [])]),
      matchAll,
    );
    expect(result).toEqual([
      {
        scorecardId: "scd_human",
        appliesTo: "human",
        scoredTeamMemberId: "tmh_jane",
        autoScoringRuleId: "asr_iqs",
      },
    ]);
  });

  it("scorecard with rule(s) whose predicate(s) don't match is pruned", () => {
    const result = pickScorecardAssignments(
      HUMAN_ONLY,
      [sc("scd_human", "human"), sc("scd_res", "resolution")],
      rulesMap([rule("asr_human", "scd_human", 100, [])]),
      matchNone,
    );
    // Human pruned (rule's predicate doesn't match). Resolution has no rule
    // so it fires via the implicit default.
    expect(result).toEqual([
      {
        scorecardId: "scd_res",
        appliesTo: "resolution",
        scoredTeamMemberId: null,
        autoScoringRuleId: null,
      },
    ]);
  });

  it("multiple rules on same scorecard: priority ASC wins; first matching predicate attaches", () => {
    // Two rules on the same scorecard. The winning rule should be the one
    // with the lowest priority value (ASC) whose predicate matches.
    //   - asr_winner: priority 50, predicate []  → wins (lower priority +
    //                                              matches via match-all)
    //   - asr_runner_up: priority 100, predicate [] → would match but loses
    //                                                  on priority
    //   - asr_blocked: priority 10, predicate [sentinel that matcher rejects]
    //                                              → priority best, but
    //                                              pruned by predicate
    // Even though asr_blocked has the lowest priority, the matcher rejects
    // its predicate, so the picker moves on to the next-best (asr_winner).
    const winner = rule("asr_winner", "scd_human", 50, []);
    const runnerUp = rule("asr_runner_up", "scd_human", 100, []);
    const blocked = rule("asr_blocked", "scd_human", 10, [
      { propertyId: "subject", op: "contains", value: "no-match" } as Filter,
    ]);
    const result = pickScorecardAssignments(
      HUMAN_ONLY,
      [sc("scd_human", "human")],
      rulesMap([runnerUp, blocked, winner]),
      (predicate) =>
        predicate.length === 0 ||
        predicate.every((f) => f.value !== "no-match"),
    );
    expect(result).toEqual([
      {
        scorecardId: "scd_human",
        appliesTo: "human",
        scoredTeamMemberId: "tmh_jane",
        autoScoringRuleId: "asr_winner",
      },
    ]);
  });

  it("empty scorecard list returns empty assignments", () => {
    expect(
      pickScorecardAssignments(MIXED, [], rulesMap([]), matchAll),
    ).toEqual([]);
  });

  it("re-running with the same inputs produces identical assignments (idempotent at the picker layer)", () => {
    const scorecards = [
      sc("scd_human", "human"),
      sc("scd_ai", "ai"),
      sc("scd_res", "resolution"),
    ];
    const first = pickScorecardAssignments(
      MIXED,
      scorecards,
      rulesMap([]),
      matchAll,
    );
    const second = pickScorecardAssignments(
      MIXED,
      scorecards,
      rulesMap([]),
      matchAll,
    );
    expect(first).toEqual(second);
  });
});
