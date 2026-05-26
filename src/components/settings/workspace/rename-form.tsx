"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Pencil, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { renameWorkspace } from "@/lib/workspaces/actions";

export function RenameForm({
  currentName,
  isAdmin,
}: {
  currentName: string;
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  if (!isAdmin) {
    return <span className="text-base text-foreground">{currentName}</span>;
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-base text-foreground">{currentName}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Rename workspace"
        >
          <Pencil size={13} />
        </button>
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await renameWorkspace(null, formData);
      if (result.ok) {
        setEditing(false);
        setError(null);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        ref={inputRef}
        name="name"
        defaultValue={currentName}
        maxLength={100}
        className="h-7 w-64 text-base"
        aria-label="Workspace name"
      />
      <button
        type="submit"
        disabled={isPending}
        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
        aria-label="Save"
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setError(null);
        }}
        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Cancel"
      >
        <X size={14} />
      </button>
      {error && (
        <span className="text-sm text-destructive">{error}</span>
      )}
    </form>
  );
}
