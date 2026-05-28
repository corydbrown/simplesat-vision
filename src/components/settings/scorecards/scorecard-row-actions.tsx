"use client";

import { useState } from "react";
import { Copy, MoreHorizontal, Archive, ArchiveRestore } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  scorecardName: string;
  isArchived: boolean;
  isPending: boolean;
  onDuplicate: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
};

/** Per-row actions menu for the scorecard list. Edit lives on the row link
 *  itself; this menu carries the secondary actions (duplicate, archive /
 *  unarchive) with a confirmation step for archive (destructive-feeling
 *  even though it's soft delete). */
export function ScorecardRowActions({
  scorecardName,
  isArchived,
  isPending,
  onDuplicate,
  onArchive,
  onUnarchive,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${scorecardName}`}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            disabled={isPending}
          >
            <MoreHorizontal size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              onDuplicate();
            }}
            className="cursor-pointer"
          >
            <Copy size={14} />
            Duplicate
          </DropdownMenuItem>
          {isArchived ? (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onUnarchive();
              }}
              className="cursor-pointer"
            >
              <ArchiveRestore size={14} />
              Unarchive
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              variant="destructive"
              onSelect={(e) => {
                e.preventDefault();
                setConfirmOpen(true);
              }}
              className="cursor-pointer"
            >
              <Archive size={14} />
              Archive
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive scorecard?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{scorecardName}&quot; will be hidden from pickers but
              existing evaluations will still render against their pinned
              version. You can unarchive it anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="cursor-pointer"
              onClick={() => {
                setConfirmOpen(false);
                onArchive();
              }}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
