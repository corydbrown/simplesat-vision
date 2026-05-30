"use client";

import { Bookmark, ChevronDown, Plus, RotateCcw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useColumnStateMaybe } from "@/lib/column-prefs";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { viewStateEquals } from "@/lib/views/equals";
import { ALL_VIEW_LABEL } from "@/lib/views/seed";
import { useViews } from "@/lib/views/provider";
import { ALL_VIEW_ID, emptyViewState, type EntityKey } from "@/lib/views/types";
import {
  VIEW_ID_PARAM,
  VIEW_PARAM_KEYS,
  readViewState,
  writeViewState,
} from "@/lib/views/url";

/** Toolbar slot that surfaces the Reset / Save / Create-new affordances
 *  whenever the URL state diverges from the active saved view.
 *
 *  - "All ENTITY" (hardcoded, immutable): only Reset surfaces, since the
 *    user can mutate URL state but cannot overwrite the underlying view.
 *  - A saved editable view: Reset + split-button [Save current view ▾]
 *    (dropdown surfaces "Create new view"). The split-button is primary
 *    color to read as the obvious affordance once a change has been made.
 *  - Either case: nothing renders when the URL matches the saved state. */
export function ViewActions({
  entityKey,
  basePath,
  allowedGroupIds,
}: {
  entityKey: EntityKey;
  basePath: string;
  allowedGroupIds: readonly string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getView, updateViewState, createView } = useViews();
  const columnCtx = useColumnStateMaybe();
  const [createOpen, setCreateOpen] = useState(false);

  const viewId = searchParams.get(VIEW_ID_PARAM) ?? ALL_VIEW_ID;
  const currentState = useMemo(
    () => readViewState(searchParams, allowedGroupIds),
    [searchParams, allowedGroupIds],
  );

  const savedView = viewId === ALL_VIEW_ID ? null : getView(entityKey, viewId);
  const savedState = useMemo(
    () =>
      viewId === ALL_VIEW_ID
        ? emptyViewState()
        : (savedView?.state ?? null),
    [viewId, savedView],
  );

  // Unknown view id (stale link, view deleted elsewhere) — degrade to "All".
  const treatAsAll = viewId === ALL_VIEW_ID || savedState === null;
  const dirty = savedState ? !viewStateEquals(currentState, savedState) : false;

  const handleReset = useCallback(() => {
    if (treatAsAll) {
      const params = new URLSearchParams(searchParams.toString());
      for (const key of VIEW_PARAM_KEYS) params.delete(key);
      params.delete(VIEW_ID_PARAM);
      params.delete("page");
      const qs = params.toString();
      router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
      return;
    }
    if (!savedState) return;
    const params = new URLSearchParams(searchParams.toString());
    writeViewState(params, savedState);
    params.set(VIEW_ID_PARAM, viewId);
    params.delete("page");
    router.push(`${basePath}?${params.toString()}`, { scroll: false });
    // Column state lives outside the URL; replay it from the saved view
    // when present, otherwise leave the per-tableId defaults alone.
    if (savedState.columns) columnCtx?.replace(savedState.columns);
  }, [
    treatAsAll,
    savedState,
    searchParams,
    router,
    basePath,
    viewId,
    columnCtx,
  ]);

  const handleSave = useCallback(() => {
    if (treatAsAll || !savedView) return;
    // Capture the live column layout into the view so navigating away and
    // back restores the same column widths / order / visibility.
    const next = {
      ...currentState,
      columns: columnCtx?.state ?? savedView.state.columns,
    };
    updateViewState(entityKey, savedView.id, next);
    toast(`Saved changes to "${savedView.name}"`);
  }, [
    treatAsAll,
    savedView,
    updateViewState,
    entityKey,
    currentState,
    columnCtx,
  ]);

  const handleCreate = useCallback(
    (name: string) => {
      const created = createView(entityKey, name, {
        ...currentState,
        columns: columnCtx?.state,
      });
      const params = new URLSearchParams(searchParams.toString());
      writeViewState(params, created.state);
      params.set(VIEW_ID_PARAM, created.id);
      params.delete("page");
      router.push(`${basePath}?${params.toString()}`, { scroll: false });
      toast(`Created view "${created.name}"`);
    },
    [
      createView,
      entityKey,
      currentState,
      columnCtx,
      searchParams,
      router,
      basePath,
    ],
  );

  if (!dirty) return null;

  return (
    <>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 cursor-pointer gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              onClick={handleReset}
            >
              <RotateCcw size={13} />
              Reset
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {treatAsAll
              ? `Clear filters and return to ${ALL_VIEW_LABEL[entityKey]}`
              : `Discard changes to "${savedView?.name ?? ""}"`}
          </TooltipContent>
        </Tooltip>
        {!treatAsAll && savedView ? (
          <SaveSplitButton
            onSave={handleSave}
            onCreate={() => setCreateOpen(true)}
            saveTitle={`Save changes to "${savedView.name}"`}
          />
        ) : (
          <Button
            size="sm"
            className="h-8 cursor-pointer gap-1.5 text-sm"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={13} />
            Create new view
          </Button>
        )}
      </div>
      <CreateViewDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
      />
    </>
  );
}

/** Primary-color split button: the wide left half saves; the narrow right
 *  half opens a dropdown with secondary actions. Uses shadcn's ButtonGroup
 *  so border-radius and adjacent-border handling come straight from the
 *  design system instead of getting hand-rolled. */
function SaveSplitButton({
  onSave,
  onCreate,
  saveTitle,
}: {
  onSave: () => void;
  onCreate: () => void;
  saveTitle: string;
}) {
  return (
    <ButtonGroup>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            className="h-8 cursor-pointer gap-1.5 text-sm"
            onClick={onSave}
          >
            <Bookmark size={13} />
            Save current view
          </Button>
        </TooltipTrigger>
        <TooltipContent>{saveTitle}</TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            className="h-8 cursor-pointer px-1.5"
            aria-label="More save options"
          >
            <ChevronDown size={13} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={onCreate} className="cursor-pointer">
            <Plus size={13} />
            Create new view
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}

function CreateViewDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) setName("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create new view</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="View name"
            className="text-base"
          />
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleOpenChange(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim()}
              className="cursor-pointer"
            >
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
