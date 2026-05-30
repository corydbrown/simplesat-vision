"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  createScorecard,
  duplicateScorecard,
} from "@/lib/scorecards/actions";

type Mode =
  | { kind: "create" }
  | { kind: "duplicate"; sourceId: string; sourceName: string };

type Props = {
  open: boolean;
  mode: Mode;
  onOpenChange: (open: boolean) => void;
};

/** Name-input dialog for both "New scorecard" (template = IQS) and
 *  "Duplicate" (template = source scorecard). On success navigates to the
 *  editor for the new id so the manager can immediately tune it. */
export function NewScorecardDialog({ open, mode, onOpenChange }: Props) {
  const [name, setName] = useState(() =>
    mode.kind === "duplicate" ? `${mode.sourceName} copy` : "",
  );
  const [isSaving, startSaving] = useTransition();
  const router = useRouter();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || isSaving) return;
    startSaving(async () => {
      try {
        const result =
          mode.kind === "create"
            ? await createScorecard({ name: trimmed })
            : await duplicateScorecard({
                scorecardId: mode.sourceId,
                name: trimmed,
              });
        toast(
          mode.kind === "create"
            ? `Created "${trimmed}"`
            : `Duplicated as "${trimmed}"`,
        );
        onOpenChange(false);
        router.push(`/settings/scorecards/${result.scorecardId}`);
        router.refresh();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not create scorecard");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setName(mode.kind === "duplicate" ? `${mode.sourceName} copy` : "");
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode.kind === "create" ? "New scorecard" : "Duplicate scorecard"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Scorecard name"
            className="text-base"
          />
          {mode.kind === "create" && (
            <p className="text-sm text-muted-foreground">
              Starts from the IQS template — tune categories and criteria in
              the editor.
            </p>
          )}
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
              disabled={!name.trim() || isSaving}
              className="cursor-pointer"
            >
              {isSaving
                ? mode.kind === "create"
                  ? "Creating…"
                  : "Duplicating…"
                : mode.kind === "create"
                  ? "Create"
                  : "Duplicate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
