"use client";

import { Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { buildReportFromPrompt } from "@/lib/reports/actions";
import type { BaseEntity, ReportConfig } from "@/lib/reports/types";

const SUGGESTIONS = [
  "Avg CSAT by team member by month",
  "Returns CES by group",
  "Detractor rate by loyalty tier",
];

export function AiPromptDialog({
  base,
  onResult,
}: {
  base: BaseEntity;
  onResult: (config: ReportConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (text: string) => {
    if (!text.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const config = await buildReportFromPrompt(text, base);
        onResult(config);
        setOpen(false);
        setPrompt("");
      } catch {
        setError("Couldn't build that. Try rephrasing.");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 cursor-pointer">
          <Sparkles size={14} className="text-primary" />
          Build with AI
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Build a report with AI</DialogTitle>
          <DialogDescription>
            Describe the question you want to answer. AI will configure the
            pivot for you.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit(prompt);
            }}
            autoFocus
            placeholder="e.g. avg CSAT by team member by month"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-col gap-1">
            <div className="text-xs text-muted-foreground">Try one of</div>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setPrompt(s);
                    submit(s);
                  }}
                  className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground hover:bg-accent cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            onClick={() => submit(prompt)}
            disabled={pending || !prompt.trim()}
            className="cursor-pointer"
          >
            {pending ? "Building…" : "Build"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
