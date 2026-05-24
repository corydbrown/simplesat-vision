"use client";

import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";

/** Cheat-sheet dialog for the full coaching keyboard reference. Visible
 *  kbd-hint badges are intentionally HIDDEN throughout the surface (V1
 *  spec) — this dialog is the single discoverability surface. */
export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="size-4" />
            Keyboard shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div className="mb-1.5 text-sm font-medium text-muted-foreground">
                {g.title}
              </div>
              <ul className="space-y-1">
                {g.rows.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 text-base text-foreground"
                  >
                    <span>{r.desc}</span>
                    <span className="flex shrink-0 items-center gap-0.5">
                      {r.keys.map((k, ki) => (
                        <Kbd key={ki}>{k}</Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const GROUPS: { title: string; rows: { keys: string[]; desc: string }[] }[] = [
  {
    title: "Navigate",
    rows: [
      { keys: ["↑", "↓"], desc: "Move focus between messages" },
      { keys: ["J", "K"], desc: "Move focus (vim)" },
      { keys: ["→"], desc: "Enter QA panel" },
      { keys: ["←"], desc: "Return to convo" },
      { keys: ["↵"], desc: "Inspect focused message" },
    ],
  },
  {
    title: "Coach",
    rows: [
      { keys: ["C"], desc: "Comment on focused message" },
      { keys: ["T"], desc: "Cite (agent messages only)" },
      { keys: ["R"], desc: "React" },
    ],
  },
  {
    title: "Compose",
    rows: [
      { keys: ["↵"], desc: "Post comment" },
      { keys: ["⇧", "↵"], desc: "Newline" },
      { keys: ["↑"], desc: "Edit last own comment (empty composer)" },
      { keys: ["Esc"], desc: "Blur composer" },
    ],
  },
  {
    title: "Esc layers",
    rows: [
      { keys: ["Esc"], desc: "Close picker → blur → exit Inspect → clear mute" },
    ],
  },
  {
    title: "Help",
    rows: [{ keys: ["?"], desc: "Toggle this cheat sheet" }],
  },
];
