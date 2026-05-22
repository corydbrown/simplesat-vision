"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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
import { useToast } from "./toast";
import { useViews } from "@/lib/views/provider";
import type { EntityKey, SavedView } from "@/lib/views/types";

/** Dropdown menu wrapping the per-view Rename / Delete actions. Shared by
 *  the topbar `…` page-actions affordance and the sidebar per-view kebab so
 *  both surfaces stay in sync as new items get added. The trigger is
 *  caller-supplied via `children` (`asChild` target) to keep button styling
 *  surface-specific without bleeding into the menu logic. */
export function ViewActionsMenu({
  entity,
  view,
  align = "end",
  onDeleted,
  children,
}: {
  entity: EntityKey;
  view: SavedView;
  align?: "start" | "end";
  /** Fired after the delete has been committed. Use for surface-specific
   *  side effects (e.g. router.push when the deleted view is currently
   *  active). */
  onDeleted?: () => void;
  children: React.ReactNode;
}) {
  const { renameView, deleteView } = useViews();
  const toast = useToast();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Bumps on every "open rename" click. The dialog's `key` is bound to
  // this counter combined with the current view id, which forces a fresh
  // mount each time the user opens the dialog. Without it, the dialog's
  // input state (a draft string the user may have typed and cancelled)
  // would persist across opens and across navigation between views.
  const [renameMountKey, setRenameMountKey] = useState(0);

  function openRename() {
    setRenameMountKey((k) => k + 1);
    setRenameOpen(true);
  }

  function handleRename(name: string) {
    renameView(entity, view.id, name);
    toast(`Renamed to "${name}"`);
  }

  function handleDelete() {
    const name = view.name;
    deleteView(entity, view.id);
    toast(`Deleted view "${name}"`);
    onDeleted?.();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-44">
          <DropdownMenuItem
            onSelect={openRename}
            className="cursor-pointer"
          >
            <Pencil size={13} />
            Rename view
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleteOpen(true)}
            className="cursor-pointer"
          >
            <Trash2 size={13} />
            Delete view
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RenameViewDialog
        key={`${view.id}:${renameMountKey}`}
        open={renameOpen}
        onOpenChange={setRenameOpen}
        initialName={view.name}
        onRename={handleRename}
      />
      <DeleteViewDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        viewName={view.name}
        onConfirm={handleDelete}
      />
    </>
  );
}

function RenameViewDialog({
  open,
  onOpenChange,
  initialName,
  onRename,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  onRename: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === initialName) {
      onOpenChange(false);
      return;
    }
    onRename(trimmed);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename view</DialogTitle>
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
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || name.trim() === initialName}
              className="cursor-pointer"
            >
              Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteViewDialog({
  open,
  onOpenChange,
  viewName,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewName: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete view?</AlertDialogTitle>
          <AlertDialogDescription>
            &quot;{viewName}&quot; will be removed from the sidebar. This
            can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            className="cursor-pointer"
            onClick={onConfirm}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
