"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  GripVertical,
  Plus,
  Sparkles,
  Zap,
} from "lucide-react";
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/shared/toast";
import {
  reorderAutoScoringRulesAction,
  toggleAutoScoringRuleAction,
} from "@/lib/auto-scoring/actions";
import type { AutoScoringRuleListRow } from "@/db/queries/auto-scoring-rules";
import type { ScorecardSummary } from "@/db/queries/scorecards";

type Props = {
  rules: AutoScoringRuleListRow[];
  scorecards: ScorecardSummary[];
  scoredLast24h: number;
};

export function RulesList({ rules, scorecards, scoredLast24h }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [order, setOrder] = useState<AutoScoringRuleListRow[]>(rules);
  const [, startReordering] = useTransition();
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);
  const [isToggling, startToggling] = useTransition();

  const scorecardNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of scorecards) map.set(s.id, s.name);
    return map;
  }, [scorecards]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      const oldIndex = order.findIndex((r) => r.id === active.id);
      const newIndex = order.findIndex((r) => r.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const next = arrayMove(order, oldIndex, newIndex);
      setOrder(next);
      startReordering(async () => {
        try {
          await reorderAutoScoringRulesAction({
            orderedIds: next.map((r) => r.id),
          });
          router.refresh();
        } catch (err) {
          toast(
            err instanceof Error ? err.message : "Could not reorder rules",
          );
          // Revert local state so what the user sees matches what was saved.
          setOrder(order);
        }
      });
    },
    [order, router, toast],
  );

  const onToggle = (id: string, enabled: boolean) => {
    if (isToggling) return;
    setPendingToggleId(id);
    setOrder((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled } : r)),
    );
    startToggling(async () => {
      try {
        await toggleAutoScoringRuleAction({ id, enabled });
        router.refresh();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not update rule");
        setOrder((prev) =>
          prev.map((r) => (r.id === id ? { ...r, enabled: !enabled } : r)),
        );
      } finally {
        setPendingToggleId(null);
      }
    });
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Auto-scoring
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Rules that route resolved tickets to scorecards automatically.
            Higher up the list means higher priority — the first rule that
            matches a ticket scores it.
          </p>
        </div>
        <Button asChild className="shrink-0 cursor-pointer">
          <Link href="/settings/auto-scoring/new">
            <Plus size={14} />
            New rule
          </Link>
        </Button>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {order.length === 0 ? (
          <EmptyState />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={order.map((r) => r.id)}
              strategy={verticalListSortingStrategy}
            >
              {order.map((rule) => (
                <SortableRuleRow
                  key={rule.id}
                  rule={rule}
                  scorecardName={
                    rule.scorecard?.name ??
                    scorecardNameById.get(rule.scorecardId) ??
                    "Unknown scorecard"
                  }
                  isToggling={pendingToggleId === rule.id && isToggling}
                  onToggle={(enabled) => onToggle(rule.id, enabled)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Last 24h:{" "}
        <span className="font-medium text-foreground">{scoredLast24h}</span>{" "}
        {scoredLast24h === 1 ? "ticket" : "tickets"} scored by rules.
      </p>
    </div>
  );
}

function SortableRuleRow({
  rule,
  scorecardName,
  isToggling,
  onToggle,
}: {
  rule: AutoScoringRuleListRow;
  scorecardName: string;
  isToggling: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rule.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10 transition-colors hover:bg-accent/30 ${
        isDragging ? "opacity-70 shadow-lg" : ""
      } ${rule.enabled ? "" : "opacity-60"}`}
    >
      <button
        type="button"
        className="flex h-8 w-6 cursor-grab items-center justify-center text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>

      <Link
        href={`/settings/auto-scoring/${rule.id}`}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-medium text-foreground">
              {rule.name}
            </span>
            <RoutingPill scorecardName={scorecardName} />
          </div>
          <div className="mt-1 text-base text-muted-foreground">
            {rule.samplingPercent}% sampling ·{" "}
            {rule.dailyCap !== null
              ? `cap ${rule.dailyCap}/day`
              : "no daily cap"}
            {rule.filterPredicate.length > 0
              ? ` · ${rule.filterPredicate.length} filter${rule.filterPredicate.length === 1 ? "" : "s"}`
              : " · all tickets"}
          </div>
        </div>
        <ArrowUpRight
          size={16}
          className="shrink-0 text-muted-foreground/60 transition-colors group-hover:text-foreground"
        />
      </Link>

      <div
        className="flex items-center gap-2"
        onClick={(e) => e.preventDefault()}
      >
        <Switch
          checked={rule.enabled}
          disabled={isToggling}
          onCheckedChange={onToggle}
          aria-label={
            rule.enabled ? "Disable this rule" : "Enable this rule"
          }
        />
      </div>
    </div>
  );
}

function RoutingPill({ scorecardName }: { scorecardName: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent/40 px-2 py-0.5 text-sm text-foreground/80">
      <Zap size={11} className="text-muted-foreground" />
      {scorecardName}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl bg-card px-6 py-10 text-center ring-1 ring-foreground/10">
      <Sparkles size={20} className="mx-auto text-blue-dark" aria-hidden />
      <h2 className="mt-3 text-base font-medium text-foreground">
        No auto-scoring yet
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-base text-muted-foreground">
        Without a rule, tickets only get scored when someone clicks &ldquo;Score
        this ticket.&rdquo; Add a rule to start scoring resolved tickets
        automatically.
      </p>
      <div className="mt-4">
        <Button asChild className="cursor-pointer">
          <Link href="/settings/auto-scoring/new">
            <Plus size={14} />
            New rule
          </Link>
        </Button>
      </div>
    </div>
  );
}
