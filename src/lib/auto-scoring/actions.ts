"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  createAutoScoringRule,
  deleteAutoScoringRule,
  reorderAutoScoringRules,
  updateAutoScoringRule,
} from "@/db/queries/auto-scoring-rules";
import { countTicketsMatchingPredicate } from "@/lib/qa/auto-scoring/match-rule";
import { runRuleOnce } from "@/lib/qa/auto-scoring/run-rule-once";
import { FilterSchema } from "@/lib/filters/schemas";
import { requireWorkspace } from "@/lib/workspace";

const FilterPredicate = z.array(FilterSchema);

const RuleCoreSchema = z.object({
  name: z.string().trim().min(1).max(200),
  enabled: z.boolean(),
  scorecardId: z.string().min(1),
  samplingPercent: z.number().int().min(1).max(100),
  dailyCap: z.number().int().min(1).max(100000).nullable(),
  priority: z.number().int().min(1).max(10000),
  filterPredicate: FilterPredicate,
});

const CreateRuleSchema = RuleCoreSchema;
const UpdateRuleSchema = RuleCoreSchema.extend({
  id: z.string().min(1),
});

export type AutoScoringRuleFormInput = z.infer<typeof RuleCoreSchema>;

export async function createAutoScoringRuleAction(
  input: unknown,
): Promise<{ id: string }> {
  const workspaceId = await requireWorkspace();
  const parsed = CreateRuleSchema.parse(input);
  const id = await createAutoScoringRule({
    workspaceId,
    name: parsed.name,
    enabled: parsed.enabled,
    scorecardId: parsed.scorecardId,
    samplingPercent: parsed.samplingPercent,
    dailyCap: parsed.dailyCap,
    priority: parsed.priority,
    filterPredicate: parsed.filterPredicate,
  });
  revalidatePath("/settings/auto-scoring");
  return { id };
}

export async function updateAutoScoringRuleAction(
  input: unknown,
): Promise<{ ok: true }> {
  const workspaceId = await requireWorkspace();
  const parsed = UpdateRuleSchema.parse(input);
  await updateAutoScoringRule(workspaceId, parsed.id, {
    name: parsed.name,
    enabled: parsed.enabled,
    scorecardId: parsed.scorecardId,
    samplingPercent: parsed.samplingPercent,
    dailyCap: parsed.dailyCap,
    priority: parsed.priority,
    filterPredicate: parsed.filterPredicate,
  });
  revalidatePath("/settings/auto-scoring");
  revalidatePath(`/settings/auto-scoring/${parsed.id}`);
  return { ok: true };
}

const ToggleSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
});

export async function toggleAutoScoringRuleAction(
  input: unknown,
): Promise<{ ok: true }> {
  const workspaceId = await requireWorkspace();
  const parsed = ToggleSchema.parse(input);
  await updateAutoScoringRule(workspaceId, parsed.id, {
    enabled: parsed.enabled,
  });
  revalidatePath("/settings/auto-scoring");
  return { ok: true };
}

const ReorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

export async function reorderAutoScoringRulesAction(
  input: unknown,
): Promise<{ ok: true }> {
  const workspaceId = await requireWorkspace();
  const parsed = ReorderSchema.parse(input);
  await reorderAutoScoringRules(workspaceId, parsed.orderedIds);
  revalidatePath("/settings/auto-scoring");
  return { ok: true };
}

const DeleteSchema = z.object({ id: z.string().min(1) });

export async function deleteAutoScoringRuleAction(
  input: unknown,
): Promise<{ ok: true }> {
  const workspaceId = await requireWorkspace();
  const parsed = DeleteSchema.parse(input);
  await deleteAutoScoringRule(workspaceId, parsed.id);
  revalidatePath("/settings/auto-scoring");
  return { ok: true };
}

const PreviewCountSchema = z.object({
  filterPredicate: FilterPredicate,
});

/** Live preview: how many tickets in this workspace would match the
 *  supplied predicate? Used by the rule editor's "N eligible" chip — the
 *  editor calls this on every filter mutation, so it's deliberately a thin
 *  COUNT(*) wrapper, no joins. Resolved-only because the auto-scoring engine
 *  only fires on resolved tickets; showing match counts for in-flight ones
 *  would mislead. */
export async function previewRuleEligibleCountAction(
  input: unknown,
): Promise<{ count: number }> {
  const workspaceId = await requireWorkspace();
  const parsed = PreviewCountSchema.parse(input);
  const count = await countTicketsMatchingPredicate(
    workspaceId,
    parsed.filterPredicate,
    { resolvedOnly: true },
  );
  return { count };
}

const RunNowSchema = z.object({ id: z.string().min(1) });

export async function runAutoScoringRuleNowAction(input: unknown): Promise<{
  scored: number;
  skipped: number;
  errors: number;
}> {
  const workspaceId = await requireWorkspace();
  const parsed = RunNowSchema.parse(input);
  const result = await runRuleOnce(workspaceId, parsed.id);
  revalidatePath("/evaluations");
  revalidatePath("/settings/auto-scoring");
  revalidatePath(`/settings/auto-scoring/${parsed.id}`);
  return result;
}
