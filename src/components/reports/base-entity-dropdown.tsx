"use client";

import { ChevronDown, Inbox, Sparkles, Star, User, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BASE_ENTITY_LABEL, type BaseEntity } from "@/lib/reports/types";

const ORDER: BaseEntity[] = [
  "response",
  "evaluation",
  "customer",
  "team_member",
  "ticket",
];

const ICON: Record<BaseEntity, typeof Inbox> = {
  response: Star,
  evaluation: Sparkles,
  customer: User,
  team_member: Users,
  ticket: Inbox,
};

export function BaseEntityDropdown({
  value,
  onChange,
}: {
  value: BaseEntity;
  onChange: (next: BaseEntity) => void;
}) {
  const ActiveIcon = ICON[value];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-sm hover:bg-accent cursor-pointer">
        <span className="text-muted-foreground">Pivot over</span>
        <ActiveIcon size={14} className="text-primary" />
        <span className="text-foreground font-medium">
          {BASE_ENTITY_LABEL[value]}
        </span>
        <ChevronDown size={12} className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {ORDER.map((id) => {
          const Icon = ICON[id];
          return (
            <DropdownMenuCheckboxItem
              key={id}
              checked={value === id}
              onCheckedChange={() => onChange(id)}
            >
              <Icon size={14} className="mr-1.5 text-muted-foreground" />
              {BASE_ENTITY_LABEL[id]}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
