import Link from "next/link";
import { ArrowUpRight, Star } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Avatar } from "@/components/shared/avatar";
import { EntityPopoverBody } from "./entity-popover";
import { colorFromName, initialsFromName } from "@/lib/color-from-name";

type CommonProps = {
  size?: "sm" | "md";
  className?: string;
};

const POPOVER_PROPS = {
  className: "w-80 p-0 overflow-hidden",
  sideOffset: 4,
} as const;

export function CustomerPill({
  id,
  name,
  size = "sm",
  className,
}: CommonProps & { id: string; name: string }) {
  return (
    <HoverCard openDelay={200} closeDelay={80}>
      <HoverCardTrigger asChild>
        <BasePill
          href={`/customers/${id}`}
          avatar={
            <Avatar
              bg={colorFromName(name)}
              initials={initialsFromName(name)}
              size={size === "md" ? "md" : "sm"}
            />
          }
          label={name}
          size={size}
          className={className}
        />
      </HoverCardTrigger>
      <HoverCardContent {...POPOVER_PROPS}>
        <EntityPopoverBody entity="customer" id={id} />
      </HoverCardContent>
    </HoverCard>
  );
}

export function CompanyPill({
  name,
  size = "sm",
  className,
}: CommonProps & { name: string }) {
  if (!name) return <span className="text-muted-foreground">-</span>;
  return (
    <span
      className={`inline-flex items-center rounded px-1 py-0.5 ${
        size === "md" ? "text-base" : "text-sm"
      } text-foreground ${className ?? ""}`}
    >
      <span className="truncate">{name}</span>
    </span>
  );
}

export function TeamMemberPill({
  id,
  name,
  avatarColor,
  size = "sm",
  className,
}: CommonProps & { id: string; name: string; avatarColor: string }) {
  return (
    <HoverCard openDelay={200} closeDelay={80}>
      <HoverCardTrigger asChild>
        <BasePill
          href={`/team-members/${id}`}
          avatar={
            <Avatar
              bg={avatarColor}
              initials={initialsFromName(name)}
              size={size === "md" ? "md" : "sm"}
            />
          }
          label={name}
          size={size}
          className={className}
        />
      </HoverCardTrigger>
      <HoverCardContent {...POPOVER_PROPS}>
        <EntityPopoverBody entity="team-member" id={id} />
      </HoverCardContent>
    </HoverCard>
  );
}

export function TicketPill({
  id,
  externalId,
  subject,
  size = "sm",
  className,
}: CommonProps & { id: string; externalId?: string | null; subject?: string }) {
  const displayId = externalId ?? id;
  return (
    <HoverCard openDelay={200} closeDelay={80}>
      <HoverCardTrigger asChild>
        <Link
          href={`/tickets/${id}`}
          className={`group inline-flex items-center gap-1.5 rounded px-1 py-0.5 ${
            size === "md" ? "text-base" : "text-sm"
          } font-mono text-muted-foreground hover:bg-accent hover:text-foreground ${
            className ?? ""
          }`}
        >
          <span>{displayId}</span>
          {subject && (
            <span className="font-sans text-foreground/80 truncate">
              {subject}
            </span>
          )}
          <ArrowUpRight
            size={11}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </Link>
      </HoverCardTrigger>
      <HoverCardContent {...POPOVER_PROPS}>
        <EntityPopoverBody entity="ticket" id={id} />
      </HoverCardContent>
    </HoverCard>
  );
}

export function ResponsePill({
  rating,
  scale,
  size = "sm",
  className,
}: CommonProps & { rating: number; scale: number }) {
  const tone =
    rating <= 2
      ? "text-red-600"
      : rating === 3
        ? "text-amber-600"
        : "text-emerald-600";
  return (
    <span
      className={`inline-flex items-center gap-1 ${
        size === "md" ? "text-base" : "text-sm"
      } ${tone} ${className ?? ""}`}
    >
      <Star size={11} className="fill-current" />
      <span className="tabular-nums font-medium">
        {rating}/{scale}
      </span>
    </span>
  );
}

function BasePill({
  href,
  avatar,
  label,
  size,
  className,
}: {
  href: string;
  avatar: React.ReactNode;
  label: string;
  size: "sm" | "md";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-1.5 rounded px-1 py-0.5 ${
        size === "md" ? "text-base" : "text-sm"
      } text-foreground hover:bg-accent ${className ?? ""}`}
    >
      {avatar}
      <span className="truncate">{label}</span>
      <ArrowUpRight
        size={10}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
      />
    </Link>
  );
}
