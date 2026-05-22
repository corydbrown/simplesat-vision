"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import type { BaseEntity, ReportConfig } from "@/lib/reports/types";
import { AiPromptDialog } from "./ai-prompt-dialog";

export function AiPromptInline({
  base,
  onResult,
}: {
  base: BaseEntity;
  onResult: (config: ReportConfig) => void;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);

  const submit = () => {
    if (!text.trim()) return;
    setOpen(true);
  };

  return (
    <>
      <div className="flex items-center gap-1.5 self-center rounded-md border border-border bg-background h-8 min-w-[220px] px-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30">
        <Sparkles size={14} className="text-primary shrink-0" />
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Build with AI"
          className="flex-1 min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
      <AiPromptDialog
        open={open}
        onOpenChange={setOpen}
        initialPrompt={text}
        base={base}
        onResult={(config) => {
          onResult(config);
          setText("");
        }}
      />
    </>
  );
}
