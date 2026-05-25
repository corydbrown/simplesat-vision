"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, Star } from "lucide-react";
import { forwardRef } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Avatar } from "@/components/shared/avatar";
import { EntityPopoverBody } from "./entity-popover";
import { type DrawerEntity, fullPagePath } from "./global-drawer";
import { colorFromName, dicebearUrl, initialsFromName } from "@/lib/color-from-name";

type CommonProps = {
  size?: "sm" | "md";
  className?: string;
};

const POPOVER_PROPS = {
  className: "w-80 p-0 overflow-hidden",
  sideOffset: 4,
} as const;

// DrawerLink renders a real <a> so cmd/middle-click opens the full page in a
// new tab. Default click is intercepted: we update the URL with ?drawer=.
// Forwards refs and spreads arbitrary props so Radix HoverCard / DnD wrappers
// using `asChild` can inject pointer handlers and refs.
type DrawerLinkProps = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
> & {
  entity: DrawerEntity;
  id: string;
};

const DrawerLink = forwardRef<HTMLAnchorElement, DrawerLinkProps>(
  function DrawerLink(
    { entity, id, onClick: passedOnClick, children, ...rest },
    ref,
  ) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const href = fullPagePath(entity, id);

    function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
      passedOnClick?.(e);
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      e.preventDefault();
      const next = new URLSearchParams(searchParams.toString());
      next.set("drawer", `${entity}:${id}`);
      next.delete("dt");
      const qs = next.toString();
      router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    }

    return (
      <Link
        {...rest}
        ref={ref}
        href={href}
        onClick={handleClick}
        data-drawer-link
      >
        {children}
      </Link>
    );
  },
);

export function CustomerPill({
  id,
  name,
  size = "sm",
  className,
}: CommonProps & { id: string; name: string }) {
  return (
    <HoverCard openDelay={200} closeDelay={80}>
      <HoverCardTrigger asChild>
        <DrawerLink
          entity="customer"
          id={id}
          className={basePillClass(size, className)}
        >
          <Avatar
            bg={colorFromName(name)}
            initials={initialsFromName(name)}
            imageUrl={dicebearUrl(name)}
            size={size === "md" ? "md" : "sm"}
          />
          <span className="truncate">{name}</span>
          <ArrowUpRight size={10} className={arrowClass} />
        </DrawerLink>
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
}: CommonProps & { name: string | null | undefined }) {
  if (!name) return <span className="text-muted-foreground/40">—</span>;
  return (
    <span
      className={`inline-flex items-center ${
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
}: CommonProps & { id: string; name: string; avatarColor?: string }) {
  return (
    <HoverCard openDelay={200} closeDelay={80}>
      <HoverCardTrigger asChild>
        <DrawerLink
          entity="team-member"
          id={id}
          className={basePillClass(size, className)}
        >
          <Avatar
            bg={avatarColor ?? colorFromName(name)}
            initials={initialsFromName(name)}
            imageUrl={dicebearUrl(name)}
            size={size === "md" ? "md" : "sm"}
          />
          <span className="truncate">{name}</span>
          <ArrowUpRight size={10} className={arrowClass} />
        </DrawerLink>
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
        <DrawerLink
          entity="ticket"
          id={id}
          className={`group inline-flex cursor-pointer items-center gap-1.5 rounded -mx-1 px-1 py-0.5 ${
            size === "md" ? "text-base" : "text-sm"
          } bg-accent/40 font-mono text-muted-foreground hover:bg-accent hover:text-foreground ${
            className ?? ""
          }`}
        >
          <span>{displayId}</span>
          {subject && (
            <span className="font-sans text-foreground/80 truncate">
              {subject}
            </span>
          )}
          <ArrowUpRight size={11} className={arrowClass} />
        </DrawerLink>
      </HoverCardTrigger>
      <HoverCardContent {...POPOVER_PROPS}>
        <EntityPopoverBody entity="ticket" id={id} />
      </HoverCardContent>
    </HoverCard>
  );
}

export function ResponsePill({
  id,
  rating,
  scale,
  size = "sm",
  className,
}: CommonProps & { id?: string; rating: number; scale: number }) {
  const tone =
    rating <= 2
      ? "text-red-dark"
      : rating === 3
        ? "text-yellow-dark"
        : "text-green-dark";
  const inner = (
    <>
      <Star size={11} className="fill-current" />
      <span className="tabular-nums font-medium">
        {rating}/{scale}
      </span>
    </>
  );
  const visualClass = `inline-flex items-center gap-1 ${
    size === "md" ? "text-base" : "text-sm"
  } ${tone} ${className ?? ""}`;

  if (!id) {
    return <span className={visualClass}>{inner}</span>;
  }
  return (
    <HoverCard openDelay={200} closeDelay={80}>
      <HoverCardTrigger asChild>
        <DrawerLink
          entity="response"
          id={id}
          className={`${visualClass} group cursor-pointer rounded -mx-1 px-1 py-0.5 bg-accent/40 hover:bg-accent`}
        >
          {inner}
          <ArrowUpRight size={10} className={arrowClass} />
        </DrawerLink>
      </HoverCardTrigger>
      <HoverCardContent {...POPOVER_PROPS}>
        <EntityPopoverBody entity="response" id={id} />
      </HoverCardContent>
    </HoverCard>
  );
}

export function SurveyPill({
  id,
  name,
  metric,
  size = "sm",
  className,
}: CommonProps & {
  id: string;
  name: string;
  metric?: "csat" | "nps" | "ces" | "five_star" | "custom";
}) {
  const tag = !metric
    ? null
    : metric === "csat"
      ? "CSAT"
      : metric === "nps"
        ? "NPS"
        : metric === "ces"
          ? "CES"
          : metric === "five_star"
            ? "5★"
            : "Custom";
  return (
    <HoverCard openDelay={200} closeDelay={80}>
      <HoverCardTrigger asChild>
        <DrawerLink
          entity="survey"
          id={id}
          className={basePillClass(size, className)}
        >
          {tag && (
            <span className="inline-flex items-center justify-center rounded bg-muted px-1 text-xs font-medium text-muted-foreground">
              {tag}
            </span>
          )}
          <span className="truncate">{name}</span>
          <ArrowUpRight size={10} className={arrowClass} />
        </DrawerLink>
      </HoverCardTrigger>
      <HoverCardContent {...POPOVER_PROPS}>
        <EntityPopoverBody entity="survey" id={id} />
      </HoverCardContent>
    </HoverCard>
  );
}

function basePillClass(size: "sm" | "md", className?: string) {
  return `group inline-flex cursor-pointer items-center gap-1.5 rounded -mx-1 px-1 py-0.5 ${
    size === "md" ? "text-base" : "text-sm"
  } bg-accent/40 text-foreground hover:bg-accent ${className ?? ""}`;
}

const arrowClass =
  "text-muted-foreground transition-colors group-hover:text-foreground";
