"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Avatar } from "@/components/shared/avatar";
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
import { Textarea } from "@/components/ui/textarea";
import { formatRelative } from "@/lib/format";
import { TimestampTooltip } from "@/components/shared/timestamp-tooltip";
import { colorFromName, dicebearUrl, initialsFromName } from "@/lib/color-from-name";
import type { CoachingUserView } from "@/db/queries/coaching";
import type { CommentRow as CommentRowData } from "@/lib/qa/coaching";
import type { CoachingReaction } from "@/lib/qa/coaching";
import { cn } from "@/lib/utils";
import {
  ReactionRow,
  type ReactionAggregate,
} from "./reaction-row";

/** Notion-style coaching comment: avatar + name + muted date + body
 *  left-justified + reactions row + hover actions (edit/delete on own
 *  comments). Edit mode swaps body to an inline textarea; Enter saves,
 *  Esc cancels. */
export function CommentRow({
  comment,
  author,
  isOwn,
  reactions,
  onToggleReaction,
  onSaveEdit,
  onDelete,
  editingExternally = false,
  onEditExternallyDone,
}: {
  comment: CommentRowData;
  author: CoachingUserView | null;
  isOwn: boolean;
  reactions: ReactionAggregate[];
  onToggleReaction: (emoji: CoachingReaction) => void;
  onSaveEdit: (body: string) => void;
  onDelete: () => void;
  /** When true (set externally — e.g. by the page's up-arrow-edit-last
   *  affordance) the row mounts in edit mode without the user clicking the
   *  pencil. The row clears this back via `onEditExternallyDone`. */
  editingExternally?: boolean;
  onEditExternallyDone?: () => void;
}) {
  const [editing, setEditing] = useState(editingExternally);
  const [draft, setDraft] = useState(comment.body);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function startEdit() {
    setDraft(comment.body);
    setEditing(true);
  }
  function cancelEdit() {
    setEditing(false);
    onEditExternallyDone?.();
  }
  function saveEdit() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (trimmed !== comment.body) onSaveEdit(trimmed);
    setEditing(false);
    onEditExternallyDone?.();
  }

  // Users have a `name` (display name from WorkOS) and `email` (always set).
  // Fall back to the local-part of the email when name is null — better than
  // "Unknown" and matches the SVP-231 feedback-list rendering.
  const displayName =
    author?.name ?? author?.email?.split("@")[0] ?? "Unknown";
  const avatarColor = colorFromName(displayName);
  const imageUrl = author?.avatarUrl ?? dicebearUrl(displayName);
  const editedSuffix = comment.updatedAt > comment.createdAt ? " · edited" : "";

  return (
    <li className="group flex gap-2.5">
      <Avatar
        bg={avatarColor}
        initials={initialsFromName(displayName)}
        imageUrl={imageUrl}
        size="md"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-foreground">
            {displayName}
          </span>
          <span className="text-sm text-muted-foreground/70">
            <TimestampTooltip date={comment.createdAt}>
              <span>{formatRelative(comment.createdAt)}</span>
            </TimestampTooltip>
            {editedSuffix}
          </span>
          {isOwn && !editing && (
            <span className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={(e) => {
                  // Stop the click from reaching any ancestor — these buttons
                  // unmount themselves the moment they run (the row either
                  // enters edit mode or the comment disappears), so a
                  // document-level click-outside watcher would otherwise see
                  // a detached target and treat the click as "outside".
                  e.stopPropagation();
                  startEdit();
                }}
                aria-label="Edit comment"
                className="flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmingDelete(true);
                }}
                aria-label="Delete comment"
                className="flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Trash2 className="size-3.5" />
              </button>
            </span>
          )}
        </div>

        {editing ? (
          <div>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              className="min-h-16 resize-none text-base"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  saveEdit();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEdit();
                }
              }}
            />
            <div className="mt-1.5 flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={cancelEdit}
                className="cursor-pointer rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={!draft.trim() || draft.trim() === comment.body}
                className={cn(
                  "inline-flex cursor-pointer items-center rounded-md bg-primary px-2.5 py-1 text-sm font-medium text-primary-foreground",
                  "disabled:cursor-not-allowed disabled:opacity-40",
                )}
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-left text-base text-foreground">
            {comment.body}
          </p>
        )}

        {!editing && (
          <ReactionRow
            aggregates={reactions}
            onToggle={onToggleReaction}
            pickerSide="right"
            size="sm"
          />
        )}
      </div>

      <AlertDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
            <AlertDialogDescription>
              Once deleted, you can&apos;t get it back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="cursor-pointer bg-red-dark text-white hover:bg-red-darker"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
