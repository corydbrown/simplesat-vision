"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type {
  ScorecardEditorView,
  ScorecardEditorCategory,
  ScorecardCriterionView,
} from "@/db/queries/scorecards";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { toast } from "sonner";
import {
  saveScorecard,
  type SaveScorecardInput,
} from "@/lib/scorecards/actions";
import { CategoryCard } from "./category-card";
import {
  LlmContextEditor,
  type LlmContextDraft,
} from "./llm-context-editor";
import { TicketPreviewPanel } from "./ticket-preview-panel";

export type CategoryDraft = Omit<ScorecardEditorCategory, "criteria"> & {
  criteria: ScorecardCriterionView[];
};

type Props = {
  scorecard: ScorecardEditorView;
};

const EMPTY_BANDS: [string, string, string, string, string] = [
  "",
  "",
  "",
  "",
  "",
];

export function ScorecardEditor({ scorecard }: Props) {
  const [version, setVersion] = useState(scorecard.version);
  const [categories, setCategories] = useState<CategoryDraft[]>(
    () => scorecard.categories.map((c) => ({ ...c, criteria: [...c.criteria] })),
  );
  const [llmContext, setLlmContext] = useState<LlmContextDraft>(() => ({
    scoringPhilosophy: scorecard.scoringPhilosophy ?? "",
    bandDescriptors: normalizeBands(scorecard.bandDescriptors),
    domainContext: scorecard.domainContext ?? "",
    toneExpectations: scorecard.toneExpectations ?? "",
  }));
  const [isSaving, startSaving] = useTransition();

  // Auto-fail categories are pinned at the bottom and not part of the
  // sortable list. Anything that opts in to auto-fail (binary scale,
  // isAutofail=true) is excluded from the drag context so it can't be
  // reordered and so its presence doesn't perturb the weight UI.
  const { sortable, pinned } = useMemo(() => {
    const sortable: CategoryDraft[] = [];
    const pinned: CategoryDraft[] = [];
    for (const cat of categories) {
      if (cat.isAutofail) pinned.push(cat);
      else sortable.push(cat);
    }
    return { sortable, pinned };
  }, [categories]);

  // Derived category weight (SVP-229) = SUM(criteria.weightPercent). Computed
  // once per render and threaded into each CategoryCard for display.
  const derivedWeightByCategoryId = useMemo(() => {
    const map = new Map<string, number>();
    for (const cat of categories) {
      const sum = cat.criteria.reduce((acc, c) => acc + c.weightPercent, 0);
      map.set(cat.id, sum);
    }
    return map;
  }, [categories]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      setCategories((prev) => {
        const sortableIds = prev
          .filter((c) => !c.isAutofail)
          .map((c) => c.id);
        const oldIndex = sortableIds.indexOf(String(active.id));
        const newIndex = sortableIds.indexOf(String(over.id));
        if (oldIndex < 0 || newIndex < 0) return prev;
        const reorderedSortableIds = arrayMove(sortableIds, oldIndex, newIndex);
        const byId = new Map(prev.map((c) => [c.id, c]));
        const merged: CategoryDraft[] = [
          ...reorderedSortableIds.map((id, i) => ({
            ...byId.get(id)!,
            order: i,
          })),
          ...prev
            .filter((c) => c.isAutofail)
            .map((c, i) => ({
              ...c,
              order: reorderedSortableIds.length + i,
            })),
        ];
        return merged;
      });
    },
    [],
  );

  const onUpdateCategory = useCallback(
    (id: string, patch: Partial<CategoryDraft>) => {
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      );
    },
    [],
  );

  const onUpdateCriterion = useCallback(
    (
      categoryId: string,
      criterionId: string,
      patch: Partial<ScorecardCriterionView>,
    ) => {
      setCategories((prev) =>
        prev.map((c) =>
          c.id === categoryId
            ? {
                ...c,
                criteria: c.criteria.map((cr) =>
                  cr.id === criterionId ? { ...cr, ...patch } : cr,
                ),
              }
            : c,
        ),
      );
    },
    [],
  );

  const onUpdateLlmContext = useCallback(
    (patch: Partial<LlmContextDraft>) => {
      setLlmContext((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  // Weight totals — autofail categories are excluded from the sum since they
  // contribute via the floor mechanism, not the weighted average. The total is
  // computed from the derived category weights (= criterion sums) so the
  // indicator and the save payload can't disagree.
  const weightSum = sortable.reduce(
    (acc, c) => acc + (derivedWeightByCategoryId.get(c.id) ?? 0),
    0,
  );
  const weightValid = weightSum === 100;

  const onSave = useCallback(() => {
    if (!weightValid || isSaving) return;
    const payload: SaveScorecardInput = {
      scorecardId: scorecard.id,
      // LLM-context fields are sent on every save now that the editor owns
      // them. Empty strings clear to null on the server so the wire format
      // stays simple (no "untouched" sentinel needed once the editor is the
      // canonical caller).
      scoringPhilosophy: llmContext.scoringPhilosophy.trim()
        ? llmContext.scoringPhilosophy
        : null,
      bandDescriptors: llmContext.bandDescriptors.some((b) => b.trim())
        ? llmContext.bandDescriptors
        : null,
      domainContext: llmContext.domainContext.trim()
        ? llmContext.domainContext
        : null,
      toneExpectations: llmContext.toneExpectations.trim()
        ? llmContext.toneExpectations
        : null,
      categories: categories.map((c) => {
        const derived = derivedWeightByCategoryId.get(c.id) ?? 0;
        return {
          id: c.id,
          name: c.name,
          description: c.description,
          // Persist category weight as the live derived value (= sum of
          // criterion weights). Existing read sites (coaching, pivots,
          // rollups) keep working against the column; the editor just
          // maintains the invariant going forward.
          weightPercent: c.isAutofail ? 0 : derived,
          scaleType: c.scaleType,
          isAutofail: c.isAutofail,
          order: c.order,
          criteria: c.criteria.map((cr) => ({
            id: cr.id,
            text: cr.text,
            anchor5: cr.anchor5,
            anchor3: cr.anchor3,
            anchor1: cr.anchor1,
            weightPercent: cr.weightPercent,
          })),
        };
      }),
    };
    startSaving(async () => {
      try {
        const result = await saveScorecard(payload);
        setVersion(result.version);
        toast(`Saved as v${result.version}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Save failed";
        toast(message);
      }
    });
  }, [
    categories,
    derivedWeightByCategoryId,
    isSaving,
    llmContext,
    scorecard.id,
    weightValid,
  ]);

  // Build the live preview-scorecard the test panel reads. Mirrors the save
  // payload so the picker scores against the same in-memory draft.
  const draftScorecard = useMemo(
    () => ({
      id: scorecard.id,
      name: scorecard.name,
      version,
      categories: categories.map((c) => {
        const derived = derivedWeightByCategoryId.get(c.id) ?? 0;
        return {
          id: c.id,
          name: c.name,
          description: c.description,
          weightPercent: c.isAutofail ? 0 : derived,
          scaleType: c.scaleType,
          isAutofail: c.isAutofail,
          order: c.order,
          criteria: c.criteria.map((cr) => ({
            id: cr.id,
            text: cr.text,
            anchor5: cr.anchor5,
            anchor3: cr.anchor3,
            anchor1: cr.anchor1,
          })),
        };
      }),
    }),
    [
      categories,
      derivedWeightByCategoryId,
      scorecard.id,
      scorecard.name,
      version,
    ],
  );

  return (
    <div className="max-w-3xl">
      <SettingsPageHeader
        title={scorecard.name}
        titleSuffix={
          <span className="text-base text-muted-foreground">v{version}</span>
        }
        description="Rubric edits bump the scorecard version. Existing evaluations stay pinned to the version that produced them."
        action={
          <SaveButton
            weightSum={weightSum}
            weightValid={weightValid}
            isSaving={isSaving}
            onSave={onSave}
          />
        }
      />

      <WeightSumIndicator sum={weightSum} valid={weightValid} />

      <div className="mt-6">
        <LlmContextEditor
          value={llmContext}
          onChange={onUpdateLlmContext}
        />
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={sortable.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {sortable.map((cat) => (
              <CategoryCard
                key={cat.id}
                category={cat}
                derivedWeight={derivedWeightByCategoryId.get(cat.id) ?? 0}
                draggable
                onChangeCategory={(patch) => onUpdateCategory(cat.id, patch)}
                onChangeCriterion={(criterionId, patch) =>
                  onUpdateCriterion(cat.id, criterionId, patch)
                }
              />
            ))}
          </SortableContext>
        </DndContext>
        {pinned.map((cat) => (
          <CategoryCard
            key={cat.id}
            category={cat}
            derivedWeight={derivedWeightByCategoryId.get(cat.id) ?? 0}
            draggable={false}
            onChangeCategory={(patch) => onUpdateCategory(cat.id, patch)}
            onChangeCriterion={(criterionId, patch) =>
              onUpdateCriterion(cat.id, criterionId, patch)
            }
          />
        ))}
      </div>

      <div className="mt-10">
        <TicketPreviewPanel scorecard={draftScorecard} />
      </div>
    </div>
  );
}

function normalizeBands(
  bands: string[] | null,
): [string, string, string, string, string] {
  if (!bands) return [...EMPTY_BANDS];
  const padded = [...EMPTY_BANDS];
  for (let i = 0; i < 5; i++) {
    padded[i] = bands[i] ?? "";
  }
  return padded as [string, string, string, string, string];
}

function WeightSumIndicator({ sum, valid }: { sum: number; valid: boolean }) {
  const Icon = valid ? CheckCircle2 : AlertCircle;
  return (
    <div
      className={`mt-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${
        valid
          ? "bg-green-lighter text-green-dark"
          : "bg-yellow-lighter text-yellow-dark"
      }`}
    >
      <Icon size={14} />
      <span className="tabular-nums">
        Total weight: {sum} / 100
      </span>
      {!valid && (
        <span className="text-muted-foreground">
          — must equal 100 to save
        </span>
      )}
    </div>
  );
}

function SaveButton({
  weightSum,
  weightValid,
  isSaving,
  onSave,
}: {
  weightSum: number;
  weightValid: boolean;
  isSaving: boolean;
  onSave: () => void;
}) {
  const button = (
    <Button
      type="button"
      onClick={onSave}
      disabled={!weightValid || isSaving}
      className="cursor-pointer"
    >
      {isSaving ? "Saving…" : "Save changes"}
    </Button>
  );
  if (weightValid) return button;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        {/* The disabled <button> swallows pointer events, so the tooltip
            trigger wraps a span that still receives hover. */}
        <TooltipTrigger asChild>
          <span tabIndex={0}>{button}</span>
        </TooltipTrigger>
        <TooltipContent>
          Category weights total {weightSum}, not 100.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
