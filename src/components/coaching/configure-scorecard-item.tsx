"use client";

import Link from "next/link";
import { Settings2 } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

/** Discovery affordance from any coaching evaluation surface into the
 *  scorecard editor. Phase 1 always points at the default scorecard since
 *  there's only one; Phase 2 will resolve to the evaluation's specific
 *  scorecard (and version) once multi-scorecard support lands. */
export function ConfigureScorecardItem() {
  return (
    <DropdownMenuItem asChild>
      <Link href="/settings/scorecards/default" className="cursor-pointer">
        <Settings2 size={14} className="text-muted-foreground" />
        Configure scorecard
      </Link>
    </DropdownMenuItem>
  );
}
