"use client";

import { PanelLeft } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";
import { useModKey } from "@/lib/platform";
import { useSidebar } from "./sidebar-context";

export function SidebarToggle() {
  const { collapsed, toggle } = useSidebar();
  const mod = useModKey();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={collapsed ? "Open sidebar" : "Close sidebar"}
          onClick={toggle}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <PanelLeft size={16} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {collapsed ? "Open sidebar" : "Close sidebar"} <Kbd>{mod}</Kbd>
        <Kbd>\</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}
