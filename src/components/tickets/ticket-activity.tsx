"use client";

import { useState } from "react";
import {
  ArrowRightLeft,
  Bell,
  Bot,
  CheckCircle2,
  Circle,
  CircleAlert,
  CircleX,
  GitMerge,
  Lock,
  Mail,
  MessageSquare,
  Phone,
  Send,
  Share2,
  Sparkles,
  Tag,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import { Avatar } from "@/components/shared/avatar";
import { DetailSection } from "@/components/shared/detail-section";
import type {
  TicketEventView,
  TicketMessageView,
} from "@/db/queries/tickets";
import {
  colorFromName,
  initialsFromName,
} from "@/lib/color-from-name";
import {
  formatDateTime,
  formatSmartTime,
  formatTimelineDay,
} from "@/lib/format";

type Filter = "all" | "messages";

type RawItem =
  | { kind: "message"; item: TicketMessageView; at: number }
  | { kind: "event"; item: TicketEventView; at: number };

type RenderItem = RawItem | { kind: "day"; date: Date; at: number };

function buildTimeline(
  messages: TicketMessageView[],
  events: TicketEventView[],
  filter: Filter,
): RenderItem[] {
  const raw: RawItem[] = [
    ...messages.map(
      (m): RawItem => ({
        kind: "message",
        item: m,
        at: m.createdAt.getTime(),
      }),
    ),
    ...(filter === "all"
      ? events.map(
          (e): RawItem => ({
            kind: "event",
            item: e,
            at: e.createdAt.getTime(),
          }),
        )
      : []),
  ];
  raw.sort((a, b) => a.at - b.at);

  // Day-divider markers between items that fall on different days.
  const out: RenderItem[] = [];
  let prevDay = "";
  for (const r of raw) {
    const d = new Date(r.at);
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (dayKey !== prevDay) {
      out.push({ kind: "day", date: d, at: r.at - 1 });
      prevDay = dayKey;
    }
    out.push(r);
  }
  return out;
}

const CHANNEL_ICONS = {
  email: Mail,
  chat: MessageSquare,
  phone: Phone,
  social: Share2,
  internal: Lock,
} as const;

const CHANNEL_LABELS = {
  email: "email",
  chat: "live chat",
  phone: "phone",
  social: "social",
  internal: "internal",
} as const;

function ChannelTag({
  channel,
}: {
  channel: keyof typeof CHANNEL_ICONS;
}) {
  const Icon = CHANNEL_ICONS[channel] ?? MessageSquare;
  return (
    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
      <Icon className="size-3.5" />
      {CHANNEL_LABELS[channel]}
    </span>
  );
}

/** Row wrapper. Lays out a fixed-width rail gutter on the left and the
 *  content body on the right. The shared rail line is provided by the
 *  outer container; each row's gutter just hosts the per-item marker. */
function Row({
  marker,
  children,
}: {
  marker: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[44px_1fr] gap-4">
      <div className="relative flex justify-center pt-0.5">
        {/* Solid disc so the rail line behind the marker is hidden */}
        <span className="absolute top-0 z-0 size-10 -translate-y-0.5 rounded-full bg-background" />
        <span className="relative z-10">{marker}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function MessageRow({ message }: { message: TicketMessageView }) {
  const isAgent = message.authorRole === "agent";
  const name =
    (isAgent ? message.teamMember?.name : message.customer?.name) ??
    (isAgent ? "Agent" : "Customer");
  const color = isAgent
    ? (message.teamMember?.avatarColor ?? colorFromName(name))
    : colorFromName(name);
  const bubbleClass = isAgent
    ? "rounded-2xl rounded-tl-sm border border-primary/20 bg-primary/8 px-4 py-3 dark:border-primary/30 dark:bg-primary/15"
    : "rounded-2xl rounded-tl-sm border border-border bg-background px-4 py-3";
  const roleLabel = isAgent ? "Agent" : "Customer";
  return (
    <Row
      marker={
        <Avatar bg={color} initials={initialsFromName(name)} size="lg" />
      }
    >
      <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-sm font-semibold text-foreground">{name}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
            isAgent
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {roleLabel}
        </span>
        <ChannelTag channel={message.channel} />
        <span
          className="text-sm text-muted-foreground"
          title={formatDateTime(message.createdAt)}
        >
          · {formatSmartTime(message.createdAt)}
        </span>
      </div>
      <div className={bubbleClass}>
        <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
          {message.body}
        </p>
      </div>
    </Row>
  );
}

function InternalNoteRow({ message }: { message: TicketMessageView }) {
  const name = message.teamMember?.name ?? "Agent";
  return (
    <Row
      marker={
        <span className="flex size-10 items-center justify-center rounded-full border border-amber-300 bg-amber-100 dark:border-amber-400/40 dark:bg-amber-400/20">
          <Lock className="size-4 text-amber-700 dark:text-amber-300" />
        </span>
      }
    >
      <div className="rounded-md border border-dashed border-amber-300/70 bg-amber-50/70 px-4 py-3 dark:border-amber-400/40 dark:bg-amber-400/5">
        <div className="mb-1 flex items-baseline justify-between gap-2 text-sm text-amber-900/80 dark:text-amber-200/80">
          <span>
            <span className="font-semibold">Internal note</span>
            <span className="ml-1">from {name}</span>
          </span>
          <span
            className="tabular-nums"
            title={formatDateTime(message.createdAt)}
          >
            {formatSmartTime(message.createdAt)}
          </span>
        </div>
        <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
          {message.body}
        </p>
      </div>
    </Row>
  );
}

type EventRender = {
  Icon: typeof Circle;
  iconClass?: string;
  description: React.ReactNode;
};

const STATUS_VALUE_CLASS: Record<string, string> = {
  new: "text-foreground",
  open: "text-foreground",
  pending: "text-amber-600 dark:text-amber-400",
  solved: "text-positive dark:text-positive",
  closed: "text-muted-foreground",
};

function StatusValue({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">none</span>;
  const cls = STATUS_VALUE_CLASS[value] ?? "text-foreground";
  return <span className={`font-medium ${cls}`}>{value}</span>;
}

function renderEvent(e: TicketEventView): EventRender {
  switch (e.verb) {
    case "ticket_created":
      return {
        Icon: Sparkles,
        iconClass: "text-primary",
        description: <>Ticket created</>,
      };
    case "status_changed": {
      const Icon =
        e.newValue === "solved"
          ? CheckCircle2
          : e.newValue === "closed"
            ? CircleX
            : Circle;
      const iconClass =
        e.newValue === "solved"
          ? "text-positive"
          : e.newValue === "closed"
            ? "text-muted-foreground"
            : "text-foreground";
      return {
        Icon,
        iconClass,
        description: (
          <>
            Status changed from <StatusValue value={e.previousValue} /> to{" "}
            <StatusValue value={e.newValue} />
          </>
        ),
      };
    }
    case "assignee_changed": {
      const newName =
        (e.metadata.new_assignee_name as string | undefined) ??
        (e.metadata.assignee_name as string | undefined) ??
        e.newValue ??
        "unassigned";
      const previousName = e.metadata.previous_assignee_name as
        | string
        | undefined;
      return {
        Icon: previousName ? ArrowRightLeft : UserPlus,
        iconClass: "text-foreground",
        description: previousName ? (
          <>
            Reassigned from{" "}
            <span className="font-medium text-foreground">{previousName}</span>{" "}
            to <span className="font-medium text-foreground">{newName}</span>
          </>
        ) : (
          <>
            Assigned to{" "}
            <span className="font-medium text-foreground">{newName}</span>
          </>
        ),
      };
    }
    case "group_changed":
      return {
        Icon: ArrowRightLeft,
        iconClass: "text-muted-foreground",
        description: (
          <>
            Group changed from{" "}
            <span className="text-foreground">{e.previousValue ?? "none"}</span>{" "}
            to <span className="text-foreground">{e.newValue ?? "none"}</span>
          </>
        ),
      };
    case "priority_changed":
      return {
        Icon: e.newValue === "urgent" ? TriangleAlert : CircleAlert,
        iconClass:
          e.newValue === "urgent"
            ? "text-negative"
            : e.newValue === "high"
              ? "text-amber-600 dark:text-amber-400"
              : "text-muted-foreground",
        description: (
          <>
            Priority changed to{" "}
            <span className="font-medium text-foreground">
              {e.newValue ?? "none"}
            </span>
          </>
        ),
      };
    case "tag_added":
      return {
        Icon: Tag,
        iconClass: "text-muted-foreground",
        description: (
          <>
            Tag added:{" "}
            <span className="font-medium text-foreground">{e.newValue}</span>
          </>
        ),
      };
    case "tag_removed":
      return {
        Icon: Tag,
        iconClass: "text-muted-foreground",
        description: (
          <>
            Tag removed:{" "}
            <span className="font-medium text-foreground">
              {e.previousValue}
            </span>
          </>
        ),
      };
    case "subject_changed":
      return {
        Icon: ArrowRightLeft,
        iconClass: "text-muted-foreground",
        description: (
          <>
            Subject changed to{" "}
            <span className="font-medium text-foreground">{e.newValue}</span>
          </>
        ),
      };
    case "merged":
      return {
        Icon: GitMerge,
        iconClass: "text-muted-foreground",
        description: <>Ticket merged</>,
      };
    case "survey_sent":
      return {
        Icon: Send,
        iconClass: "text-primary",
        description: <>Survey sent to customer</>,
      };
    case "survey_response_received":
      return {
        Icon: Bell,
        iconClass: "text-positive",
        description: <>Survey response received</>,
      };
    case "sla_breached":
      return {
        Icon: TriangleAlert,
        iconClass: "text-negative",
        description: <>SLA breached</>,
      };
    case "ticket_reopened":
      return {
        Icon: Circle,
        iconClass: "text-amber-600 dark:text-amber-400",
        description: <>Ticket reopened</>,
      };
  }
}

function EventRow({ event }: { event: TicketEventView }) {
  const { Icon, iconClass, description } = renderEvent(event);
  const actorName =
    event.actor.kind === "system"
      ? "Bloom Automation"
      : event.actor.name;
  const isSystem = event.actor.kind === "system";
  return (
    <Row
      marker={
        <span className="flex size-7 items-center justify-center rounded-full border border-border bg-background">
          <Icon className={`size-4 ${iconClass ?? ""}`} />
        </span>
      }
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5">
        <span className="text-sm text-foreground">{description}</span>
        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          {isSystem ? (
            <>
              <Bot className="size-3.5" />
              {actorName}
            </>
          ) : (
            <>by {actorName}</>
          )}
        </span>
        <span
          className="text-sm text-muted-foreground"
          title={formatDateTime(event.createdAt)}
        >
          · {formatSmartTime(event.createdAt)}
        </span>
      </div>
    </Row>
  );
}

function DayDivider({ date }: { date: Date }) {
  // Day labels break out of the rail grid so the rail visually pauses
  // (no marker dot) on day boundaries. The label sits centered with
  // hairline rules on both sides so the rail "resumes" below.
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-px flex-1 bg-border" />
      <span className="text-sm font-medium text-muted-foreground">
        {formatTimelineDay(date)}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function ActivityFilter({
  value,
  onChange,
}: {
  value: Filter;
  onChange: (v: Filter) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-border bg-background p-0.5 text-sm">
      <button
        type="button"
        onClick={() => onChange("all")}
        className={`cursor-pointer rounded px-2.5 py-1 transition-colors ${
          value === "all"
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        All
      </button>
      <button
        type="button"
        onClick={() => onChange("messages")}
        className={`cursor-pointer rounded px-2.5 py-1 transition-colors ${
          value === "messages"
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Messages only
      </button>
    </div>
  );
}

export function TicketActivitySection({
  messages,
  events,
}: {
  messages: TicketMessageView[];
  events: TicketEventView[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  if (messages.length === 0 && events.length === 0) return null;

  const items = buildTimeline(messages, events, filter);

  return (
    <DetailSection
      title="Activity"
      trailing={<ActivityFilter value={filter} onChange={setFilter} />}
    >
      {/* The rail: a single absolutely-positioned vertical line down the
       *  center of the 44px gutter. Rows draw a small bg disc behind each
       *  marker so the rail visually disappears under each icon/avatar. */}
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute left-[21px] top-1 bottom-1 w-px bg-border"
        />
        <div className="relative space-y-3">
          {items.map((it, i) => {
            if (it.kind === "day") {
              return (
                <DayDivider
                  key={`d-${it.date.toISOString()}-${i}`}
                  date={it.date}
                />
              );
            }
            if (it.kind === "event") {
              return <EventRow key={`e-${it.item.id}`} event={it.item} />;
            }
            const m = it.item;
            if (!m.isPublic) {
              return <InternalNoteRow key={`m-${m.id}`} message={m} />;
            }
            return <MessageRow key={`m-${m.id}`} message={m} />;
          })}
        </div>
      </div>
    </DetailSection>
  );
}
