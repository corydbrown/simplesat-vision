import Link from "next/link";
import { ArrowUpRight, Star } from "lucide-react";
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card";
import { colorFromName, initialsFromName } from "@/lib/color-from-name";
import { EntityPopoverContent } from "./entity-popover";

type CommonProps = {
  size?: "sm" | "md";
  className?: string;
};

export function CustomerPill({
  id,
  name,
  size = "sm",
  className,
}: CommonProps & { id: string; name: string }) {
  const color = colorFromName(name);
  return (
    <HoverCard openDelay={200} closeDelay={80}>
      <HoverCardTrigger asChild>
        <BasePill
          href={`/customers/${id}`}
          avatar={
            <Avatar bg={color} initials={initialsFromName(name)} size={size} />
          }
          label={name}
          size={size}
          className={className}
        />
      </HoverCardTrigger>
      <EntityPopoverContent entity="customer" id={id} />
    </HoverCard>
  );
}

export function CompanyPill({
  name,
  size = "sm",
  className,
}: CommonProps & { name: string }) {
  if (!name) return <span className="text-muted-foreground">-</span>;
  const color = colorFromName(name);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-1 py-0.5 ${
        size === "md" ? "text-sm" : "text-xs"
      } text-foreground ${className ?? ""}`}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-sm"
        style={{ backgroundColor: color }}
      />
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
              size={size}
            />
          }
          label={name}
          size={size}
          className={className}
        />
      </HoverCardTrigger>
      <EntityPopoverContent entity="team-member" id={id} />
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
            size === "md" ? "text-sm" : "text-xs"
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
      <EntityPopoverContent entity="ticket" id={id} />
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
        size === "md" ? "text-sm" : "text-xs"
      } ${tone} ${className ?? ""}`}
    >
      <Star size={11} className="fill-current" />
      <span className="tabular-nums font-medium">
        {rating}/{scale}
      </span>
    </span>
  );
}

function Avatar({
  bg,
  initials,
  size,
}: {
  bg: string;
  initials: string;
  size: "sm" | "md";
}) {
  const dim = size === "md" ? "h-5 w-5 text-[10px]" : "h-4 w-4 text-[9px]";
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${dim}`}
      style={{ backgroundColor: bg }}
    >
      {initials || "?"}
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
        size === "md" ? "text-sm" : "text-xs"
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
