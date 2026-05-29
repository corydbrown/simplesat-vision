"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Plus, Sparkles, Star } from "lucide-react";
import type { ScorecardSummary } from "@/db/queries/scorecards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/shared/toast";
import { archiveScorecard, setDefaultScorecard } from "@/lib/scorecards/actions";
import { formatRelative } from "@/lib/format";
import { NewScorecardDialog } from "./new-scorecard-dialog";
import { ScorecardRowActions } from "./scorecard-row-actions";

type Props = {
  scorecards: ScorecardSummary[];
  /** SVP-242: workspace-default scorecard id, or null if none is set. Drives
   *  the "Default" badge on the matching row and disables the "Set as default"
   *  menu item on that row. */
  defaultScorecardId: string | null;
};

type DialogState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "duplicate"; sourceId: string; sourceName: string };

export function ScorecardsList({ scorecards, defaultScorecardId }: Props) {
  const [showArchived, setShowArchived] = useState(false);
  const [dialog, setDialog] = useState<DialogState>({ kind: "closed" });
  const [pendingArchiveId, setPendingArchiveId] = useState<string | null>(null);
  const [pendingDefaultId, setPendingDefaultId] = useState<string | null>(null);
  const [isArchiving, startArchiving] = useTransition();
  const [isSettingDefault, startSettingDefault] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const visible = useMemo(
    () =>
      showArchived
        ? scorecards
        : scorecards.filter((s) => s.archivedAt == null),
    [scorecards, showArchived],
  );

  const onArchive = (id: string, archived: boolean) => {
    if (isArchiving) return;
    setPendingArchiveId(id);
    startArchiving(async () => {
      try {
        await archiveScorecard({ scorecardId: id, archived });
        toast(archived ? "Scorecard archived" : "Scorecard restored");
        router.refresh();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not update scorecard");
      } finally {
        setPendingArchiveId(null);
      }
    });
  };

  const onSetDefault = (id: string) => {
    if (isSettingDefault) return;
    setPendingDefaultId(id);
    startSettingDefault(async () => {
      try {
        await setDefaultScorecard({ scorecardId: id });
        toast("Default scorecard updated");
        router.refresh();
      } catch (err) {
        toast(
          err instanceof Error ? err.message : "Could not update default",
        );
      } finally {
        setPendingDefaultId(null);
      }
    });
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Scorecards
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Rubrics used to evaluate ticket quality. Existing evaluations stay
            pinned to the version of the scorecard that produced them.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setDialog({ kind: "create" })}
          className="shrink-0 cursor-pointer"
        >
          <Plus size={14} />
          New scorecard
        </Button>
      </div>

      <div className="mt-6 flex items-center gap-2">
        <Switch
          id="show-archived"
          checked={showArchived}
          onCheckedChange={setShowArchived}
        />
        <label
          htmlFor="show-archived"
          className="cursor-pointer text-sm text-muted-foreground"
        >
          Show archived
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {visible.length === 0 ? (
          <EmptyState onCreate={() => setDialog({ kind: "create" })} />
        ) : (
          visible.map((s) => (
            <ScorecardRow
              key={s.id}
              scorecard={s}
              isDefault={s.id === defaultScorecardId}
              isRowPending={
                (pendingArchiveId === s.id && isArchiving) ||
                (pendingDefaultId === s.id && isSettingDefault)
              }
              onDuplicate={() =>
                setDialog({
                  kind: "duplicate",
                  sourceId: s.id,
                  sourceName: s.name,
                })
              }
              onSetDefault={() => onSetDefault(s.id)}
              onArchive={() => onArchive(s.id, true)}
              onUnarchive={() => onArchive(s.id, false)}
            />
          ))
        )}
      </div>

      <NewScorecardDialog
        open={dialog.kind !== "closed"}
        mode={
          dialog.kind === "duplicate"
            ? {
                kind: "duplicate",
                sourceId: dialog.sourceId,
                sourceName: dialog.sourceName,
              }
            : { kind: "create" }
        }
        onOpenChange={(open) => {
          if (!open) setDialog({ kind: "closed" });
        }}
      />
    </div>
  );
}

function ScorecardRow({
  scorecard,
  isDefault,
  isRowPending,
  onDuplicate,
  onSetDefault,
  onArchive,
  onUnarchive,
}: {
  scorecard: ScorecardSummary;
  isDefault: boolean;
  isRowPending: boolean;
  onDuplicate: () => void;
  onSetDefault: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
}) {
  const isArchived = scorecard.archivedAt != null;
  return (
    <div
      className={`group flex items-center gap-4 rounded-xl bg-card px-5 py-4 ring-1 ring-foreground/10 transition-colors hover:bg-accent/30 ${
        isArchived ? "opacity-60" : ""
      }`}
    >
      <Link
        href={`/settings/scorecards/${scorecard.id}`}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-medium text-foreground">
              {scorecard.name}
            </span>
            {isDefault && (
              <Badge variant="secondary">
                <Star />
                Default
              </Badge>
            )}
            {isArchived && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-sm text-muted-foreground">
                Archived
              </span>
            )}
          </div>
          <div className="mt-1 text-base text-muted-foreground">
            {scorecard.categoryCount}{" "}
            {scorecard.categoryCount === 1 ? "category" : "categories"} ·{" "}
            {scorecard.criteriaCount}{" "}
            {scorecard.criteriaCount === 1 ? "criterion" : "criteria"} · v
            {scorecard.version} · edited {formatRelative(scorecard.updatedAt)}
          </div>
        </div>
        <ArrowUpRight
          size={16}
          className="shrink-0 text-muted-foreground/60 transition-colors group-hover:text-foreground"
        />
      </Link>
      <ScorecardRowActions
        scorecardName={scorecard.name}
        isArchived={isArchived}
        isDefault={isDefault}
        isPending={isRowPending}
        onDuplicate={onDuplicate}
        onSetDefault={onSetDefault}
        onArchive={onArchive}
        onUnarchive={onUnarchive}
      />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl bg-card px-6 py-10 text-center ring-1 ring-foreground/10">
      <Sparkles
        size={20}
        className="mx-auto text-blue-dark"
        aria-hidden
      />
      <h2 className="mt-3 text-base font-medium text-foreground">
        No scorecards yet
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-base text-muted-foreground">
        Create your first scorecard to start evaluating conversations. We&apos;ll
        seed it with the IQS rubric so you have something to tune.
      </p>
      <div className="mt-4">
        <Button
          type="button"
          onClick={onCreate}
          className="cursor-pointer"
        >
          <Plus size={14} />
          New scorecard
        </Button>
      </div>
    </div>
  );
}
