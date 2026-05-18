"use client";

import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { ChannelPill } from "@/components/tickets/channel-pill";
import { StatusPill } from "@/components/tickets/status-pill";
import { Avatar } from "@/components/shared/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { colorFromName, initialsFromName } from "@/lib/color-from-name";
import { formatDate, formatDuration, formatNumber } from "@/lib/format";

type Entity = "customer" | "team-member" | "ticket";

type CustomerData = {
  id: string;
  name: string;
  email: string;
  company: string;
  tier: string;
  totalTickets: number;
  avgRating: number | null;
  totalResponses: number;
  lastSeen: string | null;
};

type TeamMemberData = {
  id: string;
  name: string;
  email: string;
  role: string;
  team: string;
  avatarColor: string;
  totalTickets: number;
  totalResponses: number;
  avgRating: number | null;
};

type TicketData = {
  id: string;
  externalId: string | null;
  subject: string;
  status: string;
  channel: string;
  customer: { id: string; name: string; company: string } | null;
  agent: { id: string; name: string; avatarColor: string } | null;
  rating: number | null;
  scale: number | null;
  createdAt: string;
  solvedAt: string | null;
};

const cache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

function fetchEntity(entity: Entity, id: string): Promise<unknown> {
  const key = `${entity}:${id}`;
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = fetch(`/api/popover/${entity}/${id}`)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      cache.set(key, data);
      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });
  inflight.set(key, p);
  return p;
}

// Body component only mounts when HoverCardContent is open (Radix unmounts
// children on close), so the fetch fires lazily.
export function EntityPopoverBody({
  entity,
  id,
}: {
  entity: Entity;
  id: string;
}) {
  const [data, setData] = useState<unknown>(() =>
    cache.get(`${entity}:${id}`) ?? null,
  );
  const [error, setError] = useState(false);

  useEffect(() => {
    if (data != null) return;
    let cancelled = false;
    fetchEntity(entity, id)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [entity, id, data]);

  if (error) {
    return (
      <div className="px-4 py-3 text-sm text-muted-foreground">
        Failed to load.
      </div>
    );
  }
  if (data == null) {
    return (
      <div className="px-4 py-3 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-3 w-40" />
      </div>
    );
  }
  if (entity === "customer") return <CustomerPopover data={data as CustomerData} />;
  if (entity === "team-member")
    return <TeamMemberPopover data={data as TeamMemberData} />;
  return <TicketPopover data={data as TicketData} />;
}

function StatBlock({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={`text-sm font-semibold tabular-nums ${tone ?? "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}

function ratingTone(r: number | null): string | undefined {
  if (r == null) return undefined;
  return r < 3 ? "text-red-600" : r < 4 ? "text-amber-600" : "text-emerald-600";
}

function CustomerPopover({ data }: { data: CustomerData }) {
  const tierLabel = data.tier.charAt(0).toUpperCase() + data.tier.slice(1);
  return (
    <div>
      <div className="px-4 py-3 flex items-start gap-3">
        <Avatar bg={colorFromName(data.name)} initials={initialsFromName(data.name)} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{data.name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {data.email}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground truncate">
              {data.company}
            </span>
            <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
              {tierLabel}
            </span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 border-t border-border px-4 py-3 bg-muted/30">
        <StatBlock label="Tickets" value={formatNumber(data.totalTickets)} />
        <StatBlock
          label="Responses"
          value={formatNumber(data.totalResponses)}
        />
        <StatBlock
          label="Avg rating"
          tone={ratingTone(data.avgRating)}
          value={
            data.avgRating != null ? (
              <span className="inline-flex items-baseline gap-0.5">
                <Star size={11} className="fill-current self-center" />
                {data.avgRating.toFixed(2)}
              </span>
            ) : (
              <span className="text-muted-foreground">-</span>
            )
          }
        />
      </div>
      {data.lastSeen && (
        <div className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border">
          Last seen {formatDate(new Date(data.lastSeen))}
        </div>
      )}
    </div>
  );
}

function TeamMemberPopover({ data }: { data: TeamMemberData }) {
  const teamTone =
    data.team === "Tier 1"
      ? "bg-blue-50 text-blue-700"
      : "bg-violet-50 text-violet-700";
  return (
    <div>
      <div className="px-4 py-3 flex items-start gap-3">
        <Avatar bg={data.avatarColor} initials={initialsFromName(data.name)} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{data.name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {data.email}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${teamTone}`}>
              {data.team}
            </span>
            <span>{data.role}</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 border-t border-border px-4 py-3 bg-muted/30">
        <StatBlock label="Tickets" value={formatNumber(data.totalTickets)} />
        <StatBlock
          label="Responses"
          value={formatNumber(data.totalResponses)}
        />
        <StatBlock
          label="Avg rating"
          tone={ratingTone(data.avgRating)}
          value={
            data.avgRating != null ? (
              <span className="inline-flex items-baseline gap-0.5">
                <Star size={11} className="fill-current self-center" />
                {data.avgRating.toFixed(2)}
              </span>
            ) : (
              <span className="text-muted-foreground">-</span>
            )
          }
        />
      </div>
    </div>
  );
}

function TicketPopover({ data }: { data: TicketData }) {
  return (
    <div>
      <div className="px-4 py-3">
        <div className="font-mono text-[11px] text-muted-foreground">
          {data.externalId ?? data.id}
        </div>
        <div className="mt-0.5 font-medium leading-tight">{data.subject}</div>
        <div className="mt-2 flex items-center gap-2">
          <StatusPill status={data.status as "open" | "pending" | "solved" | "closed"} />
          <ChannelPill channel={data.channel as "email" | "chat" | "phone" | "social"} />
        </div>
      </div>
      <div className="border-t border-border px-4 py-3 bg-muted/30 space-y-1.5 text-xs">
        {data.customer && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-20">Customer</span>
            <span className="font-medium">{data.customer.name}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground truncate">
              {data.customer.company}
            </span>
          </div>
        )}
        {data.agent && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-20">Agent</span>
            <span className="font-medium">{data.agent.name}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-20">Resolution</span>
          <span className="tabular-nums">
            {formatDuration(new Date(data.createdAt), data.solvedAt ? new Date(data.solvedAt) : null)}
          </span>
        </div>
        {data.rating != null && data.scale != null && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-20">Rating</span>
            <span className={`inline-flex items-center gap-1 ${ratingTone(data.rating)}`}>
              <Star size={11} className="fill-current" />
              <span className="font-medium tabular-nums">
                {data.rating}/{data.scale}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
