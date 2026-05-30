"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Play, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FilterRow } from "@/components/shared/filter-row";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { propertiesToDescriptors } from "@/lib/filters/adapters";
import { TICKET_PROPERTIES } from "@/lib/properties/tickets";
import {
  createAutoScoringRuleAction,
  deleteAutoScoringRuleAction,
  previewRuleEligibleCountAction,
  runAutoScoringRuleNowAction,
  updateAutoScoringRuleAction,
} from "@/lib/auto-scoring/actions";
import type { AutoScoringRuleListRow } from "@/db/queries/auto-scoring-rules";
import type { ScorecardSummary } from "@/db/queries/scorecards";
import type { Filter } from "@/lib/filters/types";

type Mode = "create" | "edit";

type Props = {
  mode: Mode;
  scorecards: ScorecardSummary[];
  /** Required when mode === "edit". Ignored for create. */
  rule?: AutoScoringRuleListRow;
};

type Draft = {
  name: string;
  enabled: boolean;
  scorecardId: string;
  samplingPercent: number;
  dailyCap: number | null;
  priority: number;
  filterPredicate: Filter[];
};

function initialDraft(props: Props): Draft {
  if (props.mode === "edit" && props.rule) {
    const r = props.rule;
    return {
      name: r.name,
      enabled: r.enabled,
      scorecardId: r.scorecardId,
      samplingPercent: r.samplingPercent,
      dailyCap: r.dailyCap,
      priority: r.priority,
      filterPredicate: r.filterPredicate ?? [],
    };
  }
  return {
    name: "",
    enabled: true,
    scorecardId: props.scorecards[0]?.id ?? "",
    samplingPercent: 100,
    dailyCap: 500,
    priority: 100,
    filterPredicate: [],
  };
}

export function RuleEditor(props: Props) {
  const router = useRouter();
  const mode: Mode = props.mode;
  const ruleId = props.rule?.id;
  const [draft, setDraft] = useState<Draft>(() => initialDraft(props));
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();
  const [isRunningNow, startRunningNow] = useTransition();
  const [eligibleCount, setEligibleCount] = useState<number | null>(null);
  const [isCountLoading, setIsCountLoading] = useState(false);

  const filterFields = useMemo(
    () => propertiesToDescriptors(TICKET_PROPERTIES),
    [],
  );

  // Live preview count. Debounced so a flurry of filter mutations doesn't
  // hammer the server — 350ms feels snappy without spamming the action.
  // setState lives inside the timeout to satisfy the react-hooks-in-effect
  // lint; the brief loading flash on the count chip is acceptable UX.
  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      if (cancelled) return;
      setIsCountLoading(true);
      try {
        const { count } = await previewRuleEligibleCountAction({
          filterPredicate: draft.filterPredicate,
        });
        if (!cancelled) setEligibleCount(count);
      } catch {
        if (!cancelled) setEligibleCount(null);
      } finally {
        if (!cancelled) setIsCountLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [draft.filterPredicate]);

  const isValid = draft.name.trim().length > 0 && draft.scorecardId !== "";

  const onSave = () => {
    if (!isValid || isSaving) return;
    startSaving(async () => {
      try {
        if (mode === "create") {
          const { id } = await createAutoScoringRuleAction({
            name: draft.name.trim(),
            enabled: draft.enabled,
            scorecardId: draft.scorecardId,
            samplingPercent: draft.samplingPercent,
            dailyCap: draft.dailyCap,
            priority: draft.priority,
            filterPredicate: draft.filterPredicate,
          });
          toast("Rule created");
          router.push(`/settings/auto-scoring/${id}`);
          router.refresh();
        } else if (ruleId) {
          await updateAutoScoringRuleAction({
            id: ruleId,
            name: draft.name.trim(),
            enabled: draft.enabled,
            scorecardId: draft.scorecardId,
            samplingPercent: draft.samplingPercent,
            dailyCap: draft.dailyCap,
            priority: draft.priority,
            filterPredicate: draft.filterPredicate,
          });
          toast("Rule saved");
          router.refresh();
        }
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not save rule");
      }
    });
  };

  const onDelete = () => {
    if (mode !== "edit" || isDeleting || !ruleId) return;
    startDeleting(async () => {
      try {
        await deleteAutoScoringRuleAction({ id: ruleId });
        toast("Rule deleted");
        router.push("/settings/auto-scoring");
        router.refresh();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not delete rule");
      }
    });
  };

  const onRunNow = () => {
    if (mode !== "edit" || isRunningNow || !ruleId) return;
    startRunningNow(async () => {
      try {
        const result = await runAutoScoringRuleNowAction({
          id: ruleId,
        });
        toast(
          result.scored > 0
            ? `Scored ${result.scored} ticket${result.scored === 1 ? "" : "s"}${
                result.skipped > 0 ? ` · ${result.skipped} skipped` : ""
              }${result.errors > 0 ? ` · ${result.errors} errors` : ""}`
            : "No new tickets to score right now.",
        );
        router.refresh();
      } catch (err) {
        toast(
          err instanceof Error ? err.message : "Could not run rule now",
        );
      }
    });
  };

  const samplingDailyEstimate = useMemo(() => {
    if (eligibleCount === null) return null;
    // Coarse "if this rule had backfilled the last 30 days" projection,
    // adjusted for the sampling roll. Stand-in for a real per-day arrival
    // rate; precise enough for a tuning UI.
    const perDay = (eligibleCount * draft.samplingPercent) / 100 / 30;
    return Math.max(0, Math.round(perDay));
  }, [eligibleCount, draft.samplingPercent]);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[420px_1fr]">
      <ConfigPane
        mode={mode}
        draft={draft}
        setDraft={setDraft}
        scorecards={props.scorecards}
        isSaving={isSaving}
        isDeleting={isDeleting}
        isRunningNow={isRunningNow}
        canSave={isValid}
        onSave={onSave}
        onDelete={mode === "edit" ? onDelete : null}
        onRunNow={mode === "edit" ? onRunNow : null}
      />
      <PreviewPane
        filterPredicate={draft.filterPredicate}
        onPredicateChange={(next) =>
          setDraft((d) => ({ ...d, filterPredicate: next }))
        }
        filterFields={filterFields}
        eligibleCount={eligibleCount}
        isCountLoading={isCountLoading}
        samplingDailyEstimate={samplingDailyEstimate}
        samplingPercent={draft.samplingPercent}
      />
    </div>
  );
}

function ConfigPane({
  mode,
  draft,
  setDraft,
  scorecards,
  isSaving,
  isDeleting,
  isRunningNow,
  canSave,
  onSave,
  onDelete,
  onRunNow,
}: {
  mode: Mode;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  scorecards: ScorecardSummary[];
  isSaving: boolean;
  isDeleting: boolean;
  isRunningNow: boolean;
  canSave: boolean;
  onSave: () => void;
  onDelete: (() => void) | null;
  onRunNow: (() => void) | null;
}) {
  return (
    <div className="flex flex-col gap-5">
      <SettingsPageHeader
        title={mode === "create" ? "New rule" : "Edit rule"}
        description="Rules score resolved tickets automatically. Priority decides which one wins when more than one matches."
      />

      <Field label="Name">
        <Input
          value={draft.name}
          onChange={(e) =>
            setDraft((d) => ({ ...d, name: e.target.value }))
          }
          placeholder="e.g. Score email tickets"
          maxLength={200}
        />
      </Field>

      <Field label="Enabled" inline>
        <Switch
          checked={draft.enabled}
          onCheckedChange={(enabled) =>
            setDraft((d) => ({ ...d, enabled }))
          }
        />
      </Field>

      <Field
        label="Scorecard"
        hint="Which rubric tickets selected by this rule are scored against."
      >
        <Select
          value={draft.scorecardId}
          onValueChange={(scorecardId) =>
            setDraft((d) => ({ ...d, scorecardId }))
          }
        >
          <SelectTrigger className="w-full cursor-pointer">
            <SelectValue placeholder="Pick a scorecard" />
          </SelectTrigger>
          <SelectContent>
            {scorecards.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
                {s.archivedAt != null ? " (archived)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field
        label={`Sampling — ${draft.samplingPercent}%`}
        hint="Fraction of matching tickets that get scored. Lower to ramp slowly."
      >
        <div className="flex items-center gap-3">
          <Slider
            value={[draft.samplingPercent]}
            min={1}
            max={100}
            step={1}
            onValueChange={(value) =>
              setDraft((d) => ({ ...d, samplingPercent: value[0] }))
            }
            className="flex-1"
          />
          <Input
            type="number"
            min={1}
            max={100}
            value={draft.samplingPercent}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (Number.isFinite(next)) {
                setDraft((d) => ({
                  ...d,
                  samplingPercent: Math.max(1, Math.min(100, next)),
                }));
              }
            }}
            className="w-20"
          />
        </div>
      </Field>

      <Field
        label="Daily cap"
        hint="Most evaluations this rule can produce per UTC day. Leave blank for no cap."
      >
        <Input
          type="number"
          min={1}
          placeholder="No cap"
          value={draft.dailyCap ?? ""}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === "") {
              setDraft((d) => ({ ...d, dailyCap: null }));
              return;
            }
            const next = Number(raw);
            if (Number.isFinite(next) && next >= 1) {
              setDraft((d) => ({ ...d, dailyCap: Math.floor(next) }));
            }
          }}
        />
      </Field>

      <Field
        label="Priority"
        hint="Lower numbers run first. Order in the rules list mirrors priority."
      >
        <Input
          type="number"
          min={1}
          value={draft.priority}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (Number.isFinite(next) && next >= 1) {
              setDraft((d) => ({ ...d, priority: Math.floor(next) }));
            }
          }}
          className="w-32"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button
          type="button"
          onClick={onSave}
          disabled={!canSave || isSaving}
          className="cursor-pointer"
        >
          {isSaving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : null}
          {mode === "create" ? "Create rule" : "Save changes"}
        </Button>
        <Button
          asChild
          variant="ghost"
          className="cursor-pointer"
        >
          <Link href="/settings/auto-scoring">Cancel</Link>
        </Button>
        {mode === "edit" && onRunNow ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                onClick={onRunNow}
                disabled={isRunningNow}
                className="cursor-pointer"
              >
                {isRunningNow ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Play size={14} />
                )}
                Run now
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Score every currently-eligible ticket against this rule&apos;s
              scorecard, up to the cap. Sampling is bypassed for this action.
            </TooltipContent>
          </Tooltip>
        ) : null}
        {mode === "edit" && onDelete ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="ml-auto cursor-pointer text-red-dark hover:bg-red-lighter hover:text-red-dark"
                disabled={isDeleting}
              >
                <Trash2 size={14} />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this rule?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tickets matching this rule will no longer be auto-scored.
                  Existing evaluations stay; they&apos;ll just lose their link
                  back to the rule.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="cursor-pointer">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  className="cursor-pointer bg-red-dark hover:bg-red-dark/90"
                  onClick={onDelete}
                >
                  Delete rule
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
    </div>
  );
}

function PreviewPane({
  filterPredicate,
  onPredicateChange,
  filterFields,
  eligibleCount,
  isCountLoading,
  samplingDailyEstimate,
  samplingPercent,
}: {
  filterPredicate: Filter[];
  onPredicateChange: (next: Filter[]) => void;
  filterFields: React.ComponentProps<typeof FilterRow>["fields"];
  eligibleCount: number | null;
  isCountLoading: boolean;
  samplingDailyEstimate: number | null;
  samplingPercent: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-medium text-foreground">
          Which tickets does this rule match?
        </h2>
        <p className="mt-1 text-base text-muted-foreground">
          Same filter language as the tickets list. Leave empty to match
          every resolved ticket in the workspace.
        </p>
      </div>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <FilterRow
          fields={filterFields}
          filters={filterPredicate}
          onChange={onPredicateChange}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-base">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/40 px-3 py-1 font-medium text-foreground">
          {isCountLoading || eligibleCount === null ? (
            <Loader2 size={12} className="animate-spin" />
          ) : null}
          {eligibleCount === null
            ? "Counting…"
            : `${eligibleCount.toLocaleString()} eligible`}
        </span>
        {samplingDailyEstimate !== null ? (
          <span className="text-muted-foreground">
            ~{samplingDailyEstimate}/day at {samplingPercent}% sampling
          </span>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">
        Eligible = resolved tickets in this workspace that match the filter
        above. The per-day estimate spreads that count across the last 30
        days; treat it as a tuning hint, not a forecast.
      </p>
    </div>
  );
}

function Field({
  label,
  hint,
  inline,
  children,
}: {
  label: string;
  hint?: string;
  inline?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        inline ? "flex items-center justify-between gap-3" : "flex flex-col gap-1.5"
      }
    >
      <div className={inline ? "" : ""}>
        <div className="text-base font-medium text-foreground">{label}</div>
        {hint ? (
          <div className="mt-0.5 text-sm text-muted-foreground">{hint}</div>
        ) : null}
      </div>
      <div className={inline ? "shrink-0" : ""}>{children}</div>
    </div>
  );
}
