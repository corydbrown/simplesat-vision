"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, GripVertical } from "lucide-react";
import type { ScorecardScaleType } from "@/db/schema";
import type { ScorecardCriterionView } from "@/db/queries/scorecards";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoryDraft } from "./scorecard-editor";

const SCALE_LABEL: Record<ScorecardScaleType, string> = {
  likert_5: "1–5 Likert",
  binary: "Binary (pass/fail)",
  three_state: "Three-state (0/1/2)",
};

type Props = {
  category: CategoryDraft;
  draggable: boolean;
  onChangeCategory: (patch: Partial<CategoryDraft>) => void;
  onChangeCriterion: (
    criterionId: string,
    patch: Partial<ScorecardCriterionView>,
  ) => void;
};

export function CategoryCard({
  category,
  draggable,
  onChangeCategory,
  onChangeCriterion,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id, disabled: !draggable });

  const style = draggable
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  return (
    <div
      ref={draggable ? setNodeRef : undefined}
      style={style}
      className="group rounded-xl bg-card ring-1 ring-foreground/10"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {draggable ? (
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            type="button"
            aria-label={`Reorder ${category.name}`}
            className="flex h-7 w-4 shrink-0 cursor-grab items-center justify-center text-muted-foreground/60 transition-opacity hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical size={14} />
          </button>
        ) : (
          // Pinned auto-fail card — reserve the grip slot so labels still
          // align with the draggable rows above it.
          <span aria-hidden className="h-7 w-4 shrink-0" />
        )}

        <Input
          value={category.name}
          onChange={(e) => onChangeCategory({ name: e.target.value })}
          className="h-8 flex-1 min-w-0"
          aria-label="Category name"
        />

        {category.isAutofail ? (
          <span className="rounded-full bg-red-lighter px-2 py-0.5 text-sm text-red-dark">
            Auto-fail
          </span>
        ) : (
          <div className="flex shrink-0 items-center gap-1.5">
            <Input
              type="number"
              min={0}
              max={100}
              value={category.weightPercent}
              onChange={(e) =>
                onChangeCategory({
                  weightPercent: clampWeight(Number(e.target.value)),
                })
              }
              className="h-8 w-16 text-right tabular-nums"
              aria-label={`${category.name} weight percent`}
            />
            <span className="text-base text-muted-foreground">%</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Collapse category" : "Expand category"}
          aria-expanded={expanded}
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent/40 hover:text-foreground"
        >
          <ChevronDown
            size={16}
            className={`transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-foreground/10 px-4 py-4">
          <div className="grid gap-4">
            <div>
              <label className="text-sm text-muted-foreground">
                Scale type
              </label>
              <div className="mt-1.5">
                <Select
                  value={category.scaleType}
                  onValueChange={(v) =>
                    onChangeCategory({ scaleType: v as ScorecardScaleType })
                  }
                >
                  <SelectTrigger className="h-8 w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.keys(SCALE_LABEL) as ScorecardScaleType[]
                    ).map((s) => (
                      <SelectItem key={s} value={s}>
                        {SCALE_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm text-muted-foreground">
                Description
              </label>
              <Textarea
                value={category.description}
                onChange={(e) =>
                  onChangeCategory({ description: e.target.value })
                }
                rows={4}
                className="mt-1.5"
              />
            </div>

            <div className="flex flex-col gap-4">
              <span className="text-sm text-muted-foreground">Criteria</span>
              {category.criteria.map((crit, i) => (
                <CriterionEditor
                  key={crit.id}
                  index={i}
                  criterion={crit}
                  showAnchors={category.scaleType === "likert_5"}
                  onChange={(patch) => onChangeCriterion(crit.id, patch)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CriterionEditor({
  index,
  criterion,
  showAnchors,
  onChange,
}: {
  index: number;
  criterion: ScorecardCriterionView;
  showAnchors: boolean;
  onChange: (patch: Partial<ScorecardCriterionView>) => void;
}) {
  return (
    <div className="rounded-lg bg-background/60 p-3 ring-1 ring-foreground/5">
      <label className="text-sm text-muted-foreground">
        Criterion {index + 1}
      </label>
      <Textarea
        value={criterion.text}
        onChange={(e) => onChange({ text: e.target.value })}
        rows={2}
        className="mt-1.5"
      />
      {showAnchors && (
        <div className="mt-3 grid gap-3">
          <AnchorField
            label="Anchor — 5 (excellent)"
            value={criterion.anchor5}
            onChange={(v) => onChange({ anchor5: v })}
          />
          <AnchorField
            label="Anchor — 3 (adequate)"
            value={criterion.anchor3}
            onChange={(v) => onChange({ anchor3: v })}
          />
          <AnchorField
            label="Anchor — 1 (poor)"
            value={criterion.anchor1}
            onChange={(v) => onChange({ anchor1: v })}
          />
        </div>
      )}
    </div>
  );
}

function AnchorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-sm text-muted-foreground">{label}</label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="mt-1.5"
      />
    </div>
  );
}

function clampWeight(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}
