"use client";

import { PanelLeft } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";
import { useSidebar } from "./sidebar-context";

export function SidebarToggle() {
  const { collapsed, toggle } = useSidebar();
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
        {collapsed ? "Open sidebar" : "Close sidebar"} <Kbd>⌘</Kbd>
        <Kbd>\</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}
