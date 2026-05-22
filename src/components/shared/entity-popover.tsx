"use client";

import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { ChannelPill } from "@/components/tickets/channel-pill";
import { StatusPill } from "@/components/tickets/status-pill";
import { Avatar } from "@/components/shared/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { colorFromName, initialsFromName } from "@/lib/color-from-name";
import { formatDate, formatDuration, formatNumber } from "@/lib/format";

type Entity = "customer" | "team-member" | "ticket" | "response" | "survey";

type CustomerData = {
  id: string;
  name: string;
  email: string;
  company: string | null;
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
  customer: { id: string; name: string; company: string | null } | null;
  teamMember: { id: string; name: string; avatarColor: string } | null;
  rating: number | null;
  scale: number | null;
  createdAt: string;
  solvedAt: string | null;
};

type SurveyData = {
  id: string;
  name: string;
  metric: "csat" | "nps" | "ces" | "five_star" | "custom";
  channel: string;
  status: string;
  scale: number;
  totalResponses: number;
  avgRating: number | null;
  lastResponseAt: string | null;
};

type ResponseData = {
  id: string;
  rating: number;
  scale: number;
  comment: string | null;
  respondedAt: string;
  ticket: { id: string; subject: string; externalId: string | null } | null;
  customer: { id: string; name: string; company: string | null } | null;
  teamMember: { id: string; name: string; avatarColor: string } | null;
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
  if (entity === "ticket") return <TicketPopover data={data as TicketData} />;
  if (entity === "survey") return <SurveyPopover data={data as SurveyData} />;
  return <ResponsePopover data={data as ResponseData} />;
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
      <div className="text-sm text-muted-foreground">
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
  return r < 3 ? "text-red-dark" : r < 4 ? "text-yellow-dark" : "text-green-dark";
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
            {data.company ? (
              <span className="text-muted-foreground truncate">
                {data.company}
              </span>
            ) : null}
            <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs">
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
              <span className="text-muted-foreground/40">—</span>
            )
          }
        />
      </div>
      {data.lastSeen && (
        <div className="px-4 py-2 text-sm text-muted-foreground border-t border-border">
          Last seen {formatDate(new Date(data.lastSeen))}
        </div>
      )}
    </div>
  );
}

const TEAM_TONES: Record<string, string> = {
  "Front line": "bg-blue-lighter text-blue-darker",
  Senior: "bg-purple-lighter text-purple-darker",
  Specialist: "bg-green-lighter text-green-darker",
};

function TeamMemberPopover({ data }: { data: TeamMemberData }) {
  const teamTone = TEAM_TONES[data.team] ?? "bg-grey-lighter text-grey-darker";
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
            <span className={`rounded-full px-1.5 py-0.5 text-xs ${teamTone}`}>
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
              <span className="text-muted-foreground/40">—</span>
            )
          }
        />
      </div>
    </div>
  );
}

function ResponsePopover({ data }: { data: ResponseData }) {
  const tone = ratingTone(data.rating);
  return (
    <div>
      <div className="px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className={`text-lg font-semibold tabular-nums ${tone ?? ""}`}>
            <Star size={13} className="inline fill-current mr-0.5 -translate-y-0.5" />
            {data.rating}/{data.scale}
          </span>
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatDate(new Date(data.respondedAt))}
          </span>
        </div>
        {data.comment && (
          <p className="mt-1 text-sm text-foreground/80 line-clamp-3">
            &ldquo;{data.comment}&rdquo;
          </p>
        )}
      </div>
      <div className="border-t border-border px-4 py-3 bg-muted/30 space-y-1.5 text-xs">
        {data.ticket && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-20">Ticket</span>
            <span className="font-mono text-muted-foreground">
              {data.ticket.externalId ?? data.ticket.id}
            </span>
            <span className="truncate text-foreground/80">
              {data.ticket.subject}
            </span>
          </div>
        )}
        {data.customer && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-20">Customer</span>
            <span className="font-medium">{data.customer.name}</span>
            {data.customer.company ? (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground truncate">
                  {data.customer.company}
                </span>
              </>
            ) : null}
          </div>
        )}
        {data.teamMember && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-20">Team member</span>
            <span className="font-medium">{data.teamMember.name}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SurveyPopover({ data }: { data: SurveyData }) {
  const metricLabel =
    data.metric === "csat"
      ? "CSAT"
      : data.metric === "nps"
        ? "NPS"
        : data.metric === "ces"
          ? "CES"
          : data.metric === "five_star"
            ? "5-Star"
            : "Custom";
  const channelLabel = data.channel.replace(/_/g, " ");
  return (
    <div>
      <div className="px-4 py-3">
        <div className="text-sm text-muted-foreground">
          {metricLabel} · {channelLabel}
        </div>
        <div className="mt-0.5 font-medium leading-tight">{data.name}</div>
      </div>
      <div className="grid grid-cols-2 gap-3 border-t border-border px-4 py-3 bg-muted/30">
        <StatBlock label="Responses" value={formatNumber(data.totalResponses)} />
        <StatBlock
          label="Avg rating"
          tone={ratingTone(data.avgRating)}
          value={
            data.avgRating != null ? (
              <span className="tabular-nums">
                {data.avgRating.toFixed(2)}/{data.scale}
              </span>
            ) : (
              <span className="text-muted-foreground/40">—</span>
            )
          }
        />
      </div>
      {data.lastResponseAt && (
        <div className="px-4 py-2 text-sm text-muted-foreground border-t border-border">
          Last response {formatDate(new Date(data.lastResponseAt))}
        </div>
      )}
    </div>
  );
}

function TicketPopover({ data }: { data: TicketData }) {
  return (
    <div>
      <div className="px-4 py-3">
        <div className="font-mono text-sm text-muted-foreground">
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
            {data.customer.company ? (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground truncate">
                  {data.customer.company}
                </span>
              </>
            ) : null}
          </div>
        )}
        {data.teamMember && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-20">Team member</span>
            <span className="font-medium">{data.teamMember.name}</span>
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
