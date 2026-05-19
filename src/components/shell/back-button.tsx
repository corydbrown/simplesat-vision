"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

export function HistoryNav() {
  const router = useRouter();
  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        aria-label="Back"
        onClick={() => router.back()}
        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <ChevronLeft size={16} />
      </button>
      <button
        type="button"
        aria-label="Forward"
        onClick={() => router.forward()}
        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
