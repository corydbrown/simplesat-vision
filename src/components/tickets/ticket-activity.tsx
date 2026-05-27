"use client";

import { useState } from "react";
import {
  ArrowRightLeft,
  Bell,
  Bot,
  CheckCircle2,
  ChevronUp,
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
  dicebearUrl,
  initialsFromName,
} from "@/lib/color-from-name";
import {
  formatAbsolute,
  formatSmartTime,
  formatTimelineDay,
} from "@/lib/format";
import { TimestampTooltip } from "@/components/shared/timestamp-tooltip";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Filter = "all" | "messages";
type Side = "left" | "right";
type Tone = "customer" | "agent" | "note";
type BubblePosition = "solo" | "first" | "middle" | "last";

type DayMarker = { kind: "day"; date: Date };
type Group = {
  kind: "group";
  side: Side;
  tone: Tone;
  items: TicketMessageView[];
  groupKey: string;
};
type EventItem = { kind: "event"; event: TicketEventView };
type TerminalEventItem = { kind: "terminal"; event: TicketEventView };
type RenderItem = DayMarker | Group | EventItem | TerminalEventItem;

const FIVE_MINUTES = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Timeline builder. Two passes: (1) chronologically interleave + insert day
// dividers, (2) collapse consecutive same-author messages into groups and
// promote the closing status_changed event (if any) to a terminal pill.
// ---------------------------------------------------------------------------

function toneFor(m: TicketMessageView): Tone {
  if (!m.isPublic) return "note";
  return m.authorRole === "agent" ? "agent" : "customer";
}

function sideFor(tone: Tone): Side {
  // Customer LEFT, agent + internal note RIGHT.
  return tone === "customer" ? "left" : "right";
}

function authorIdOf(m: TicketMessageView): string {
  return m.customer?.id ?? m.teamMember?.id ?? "anon";
}

function groupKeyOf(m: TicketMessageView): string {
  return `${toneFor(m)}|${authorIdOf(m)}|${m.channel}|${m.isPublic ? 1 : 0}`;
}

function isTerminalEvent(e: TicketEventView): boolean {
  return (
    e.verb === "status_changed" &&
    (e.newValue === "solved" || e.newValue === "closed")
  );
}

function buildTimeline(
  messages: TicketMessageView[],
  events: TicketEventView[],
  filter: Filter,
): RenderItem[] {
  type Raw =
    | { kind: "message"; item: TicketMessageView; at: number }
    | { kind: "event"; item: TicketEventView; at: number };

  const raw: Raw[] = [
    ...messages.map(
      (m): Raw => ({ kind: "message", item: m, at: m.createdAt.getTime() }),
    ),
    ...(filter === "all"
      ? events.map(
          (e): Raw => ({ kind: "event", item: e, at: e.createdAt.getTime() }),
        )
      : []),
  ];
  raw.sort((a, b) => a.at - b.at);

  // Identify the closing-beat status event. We look for the LAST
  // status_changed event that lands on solved/closed — survey_* events
  // typically fire after the resolution and shouldn't preempt the pill.
  let terminalIdx = -1;
  for (let i = raw.length - 1; i >= 0; i--) {
    const r = raw[i];
    if (r.kind === "event" && isTerminalEvent(r.item)) {
      terminalIdx = i;
      break;
    }
  }

  // Build the render list. `openGroup` is the in-progress group container;
  // when we need to emit it we splice it into `out` and start fresh. Using
  // an array slot rather than a let-binding closure to keep TS control-flow
  // analysis happy (closures over re-assignable refs widen narrowing in
  // surprising ways).
  const out: RenderItem[] = [];
  let prevDay = "";
  let openGroup: Group | undefined;

  for (let i = 0; i < raw.length; i++) {
    const it = raw[i];
    const d = new Date(it.at);
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

    if (dayKey !== prevDay) {
      if (openGroup) {
        out.push(openGroup);
        openGroup = undefined;
      }
      out.push({ kind: "day", date: d });
      prevDay = dayKey;
    }

    if (it.kind === "event") {
      if (openGroup) {
        out.push(openGroup);
        openGroup = undefined;
      }
      if (i === terminalIdx) {
        out.push({ kind: "terminal", event: it.item });
      } else {
        out.push({ kind: "event", event: it.item });
      }
      continue;
    }

    const m = it.item;
    const key = groupKeyOf(m);
    if (openGroup && openGroup.groupKey === key) {
      const lastInGroup = openGroup.items[openGroup.items.length - 1];
      if (it.at - lastInGroup.createdAt.getTime() <= FIVE_MINUTES) {
        openGroup.items.push(m);
        continue;
      }
    }
    if (openGroup) {
      out.push(openGroup);
    }
    const tone = toneFor(m);
    openGroup = {
      kind: "group",
      side: sideFor(tone),
      tone,
      items: [m],
      groupKey: key,
    };
  }
  if (openGroup) {
    out.push(openGroup);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Shared presentation helpers
// ---------------------------------------------------------------------------

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

function metaForGroup(g: Group): {
  name: string;
  avatarColor: string;
} {
  const first = g.items[0];
  if (g.tone === "customer") {
    const name = first.customer?.name ?? "Customer";
    return { name, avatarColor: colorFromName(name) };
  }
  const name = first.teamMember?.name ?? "Agent";
  return {
    name,
    avatarColor: first.teamMember?.avatarColor ?? colorFromName(name),
  };
}

// ---------------------------------------------------------------------------
// Bubble — presentational. The asymmetric "tail" corner sits at the top
// near the avatar (Intercom convention), and only on the first bubble of
// a group; follow-ups are fully rounded.
// ---------------------------------------------------------------------------

function Bubble({
  side,
  tone,
  position,
  message,
  highlighted,
}: {
  side: Side;
  tone: Tone;
  position: BubblePosition;
  message: TicketMessageView;
  highlighted: boolean;
}) {
  const showTail = position === "first" || position === "solo";
  // Match the coaching/QA bubble: always-bordered shell, small asymmetric
  // tail corner on the group's leading bubble (Intercom convention).
  const baseShape = "rounded-2xl border px-4 py-3";
  const tailShape =
    showTail && side === "left"
      ? " rounded-tl-sm"
      : showTail && side === "right"
        ? " rounded-tr-sm"
        : "";
  const toneClass =
    tone === "customer"
      ? "border-border bg-card text-foreground"
      : tone === "agent"
        ? "border-primary/20 bg-primary/10 text-foreground"
        : "border-dashed border-yellow-light bg-yellow-lighter text-foreground";
  // QA highlight ring — toggled by the supporting-message chip in the QA
  // section below. Transition is fade-in fast, fade-out slow so the user
  // catches the pulse even if they're already looking at the right message.
  const highlightClass = highlighted
    ? " ring-2 ring-primary ring-offset-2 ring-offset-background"
    : "";

  return (
    <div
      className="group/bubble relative max-w-[80%]"
      data-message-id={message.id}
    >
      <div
        className={`${baseShape}${tailShape} ${toneClass}${highlightClass} transition-shadow duration-300`}
      >
        <p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-base leading-relaxed">
          {message.body}
        </p>
      </div>
      {/* Follow-up hover timestamp — surfaces per-message time without
       *  cluttering the meta row above. Solo and first bubbles already show
       *  the time in the meta row, so suppress for those. */}
      {position !== "solo" && position !== "first" && (
        // `pointer-events-none` + opacity-revealed-on-hover means a Tooltip
        // wrapper here can't fire. Keep the native `title` fallback so the
        // absolute date+time is still discoverable.
        <span
          className={`pointer-events-none absolute top-2.5 ${
            side === "left" ? "left-full ml-2" : "right-full mr-2"
          } whitespace-nowrap text-xs text-muted-foreground opacity-0 transition-opacity group-hover/bubble:opacity-100`}
          title={formatAbsolute(message.createdAt)}
        >
          {formatSmartTime(message.createdAt)}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MessageGroup — 3-column grid with avatar in the LEFT or RIGHT gutter and
// the bubble stack in the middle column. Meta row + first bubble share the
// avatar-aligned row; follow-ups stack below.
// ---------------------------------------------------------------------------

function MessageGroup({
  group,
  highlightedMessageId,
}: {
  group: Group;
  highlightedMessageId: string | null;
}) {
  const { side, tone, items } = group;
  const { name, avatarColor } = metaForGroup(group);
  const first = items[0];

  const roleLabel =
    tone === "agent" ? "Agent" : tone === "customer" ? "Customer" : null;
  const roleClass =
    tone === "agent"
      ? "bg-primary/10 text-primary"
      : tone === "customer"
        ? "bg-muted text-muted-foreground"
        : "bg-yellow-lighter text-yellow-darker";

  return (
    <div className="grid grid-cols-[40px_1fr_40px] gap-x-3">
      {/* Left gutter */}
      <div>
        {side === "left" ? (
          <Avatar
            bg={avatarColor}
            initials={initialsFromName(name)}
            imageUrl={dicebearUrl(name)}
            size="lg"
          />
        ) : null}
      </div>

      {/* Content column */}
      <div
        className={`flex flex-col gap-1 min-w-0 ${
          side === "left" ? "items-start" : "items-end"
        }`}
      >
        {/* Meta row (first bubble only) */}
        <div
          className={`mb-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${
            side === "right" ? "justify-end" : ""
          }`}
        >
          {side === "right" && (
            <>
              <TimestampTooltip date={first.createdAt}>
                <span className="text-sm text-muted-foreground">
                  {formatSmartTime(first.createdAt)}
                </span>
              </TimestampTooltip>
              <span className="text-muted-foreground/60">·</span>
              <ChannelTag channel={first.channel} />
              {tone === "note" ? (
                <span className="inline-flex items-center gap-1 text-sm text-yellow-darker">
                  <Lock className="size-3.5" />
                  Internal note
                </span>
              ) : null}
              {roleLabel && tone !== "note" && (
                <span
                  className={`rounded px-1.5 py-0.5 text-sm font-medium ${roleClass}`}
                >
                  {roleLabel}
                </span>
              )}
              <span className="text-sm font-semibold text-foreground">
                {name}
              </span>
            </>
          )}
          {side === "left" && (
            <>
              <span className="text-sm font-semibold text-foreground">
                {name}
              </span>
              {roleLabel && (
                <span
                  className={`rounded px-1.5 py-0.5 text-sm font-medium ${roleClass}`}
                >
                  {roleLabel}
                </span>
              )}
              <ChannelTag channel={first.channel} />
              <span className="text-muted-foreground/60">·</span>
              <TimestampTooltip date={first.createdAt}>
                <span className="text-sm text-muted-foreground">
                  {formatSmartTime(first.createdAt)}
                </span>
              </TimestampTooltip>
            </>
          )}
        </div>

        {/* Bubbles */}
        {items.map((m, i) => {
          const position: BubblePosition =
            items.length === 1
              ? "solo"
              : i === 0
                ? "first"
                : i === items.length - 1
                  ? "last"
                  : "middle";
          return (
            <Bubble
              key={m.id}
              side={side}
              tone={tone}
              position={position}
              message={m}
              highlighted={highlightedMessageId === m.id}
            />
          );
        })}
      </div>

      {/* Right gutter */}
      <div>
        {side === "right" ? (
          <Avatar
            bg={avatarColor}
            initials={initialsFromName(name)}
            imageUrl={dicebearUrl(name)}
            size="lg"
          />
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event row — thin muted inline row. Icon carries the only color; the rest
// is `text-muted-foreground` except value spans which bump to foreground.
// ---------------------------------------------------------------------------

type EventRender = {
  Icon: typeof Circle;
  iconClass?: string;
  description: React.ReactNode;
};

const STATUS_VALUE_CLASS: Record<string, string> = {
  new: "text-foreground",
  open: "text-foreground",
  pending: "text-yellow-dark",
  solved: "text-green-dark",
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
          ? "text-green-dark"
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
            ? "text-red-dark"
            : e.newValue === "high"
              ? "text-yellow-dark"
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
        iconClass: "text-green-dark",
        description: <>Survey response received</>,
      };
    case "sla_breached":
      return {
        Icon: TriangleAlert,
        iconClass: "text-red-dark",
        description: <>SLA breached</>,
      };
    case "escalated":
      return {
        Icon: ChevronUp,
        iconClass: "text-red-dark",
        description: (
          <>
            Escalated to <StatusValue value={e.newValue} /> priority
          </>
        ),
      };
    case "ai_handoff":
      return {
        Icon: Bot,
        iconClass: "text-teal-dark",
        description: <>Handed off from AI bot to agent</>,
      };
    case "ticket_reopened":
      return {
        Icon: Circle,
        iconClass: "text-yellow-dark",
        description: <>Ticket reopened</>,
      };
  }
}

function EventRow({ event }: { event: TicketEventView }) {
  const { Icon, iconClass, description } = renderEvent(event);
  const actorName =
    event.actor.kind === "system" ? "Bloom Automation" : event.actor.name;
  const isSystem = event.actor.kind === "system";
  return (
    <div className="flex items-center gap-2 pl-12 text-base text-muted-foreground">
      <Icon className={`size-3.5 shrink-0 ${iconClass ?? ""}`} />
      <span>{description}</span>
      <span className="text-muted-foreground/60">·</span>
      <span className="inline-flex items-center gap-1">
        {isSystem ? (
          <>
            <Bot className="size-3.5" />
            {actorName}
          </>
        ) : (
          <>by {actorName}</>
        )}
      </span>
      <span className="text-muted-foreground/60">·</span>
      <TimestampTooltip date={event.createdAt}>
        <span>{formatSmartTime(event.createdAt)}</span>
      </TimestampTooltip>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Terminal-state pill — the closing beat for the timeline. Renders centered
// when the LAST item is a status_changed event landing on solved or closed.
// ---------------------------------------------------------------------------

function TerminalEventCard({ event }: { event: TicketEventView }) {
  const isSolved = event.newValue === "solved";
  const Icon = isSolved ? CheckCircle2 : CircleX;
  const containerClass = isSolved
    ? "bg-green-lighter border-green-light text-green-darker"
    : "bg-muted border-border text-muted-foreground";
  const actorName =
    event.actor.kind === "system" ? "Bloom Automation" : event.actor.name;
  return (
    <div className="flex justify-center pt-1">
      <div
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-base ${containerClass}`}
      >
        <Icon className="size-4 shrink-0" />
        <span className="font-medium">
          {isSolved ? "Solved" : "Closed"} by {actorName}
        </span>
        <span className="text-muted-foreground/80">·</span>
        <TimestampTooltip date={event.createdAt}>
          <span className="text-muted-foreground">
            {formatSmartTime(event.createdAt)}
          </span>
        </TimestampTooltip>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day divider, filter toggle
// ---------------------------------------------------------------------------

function DayDivider({ date }: { date: Date }) {
  return (
    <div className="flex items-center gap-3 pt-3 pb-2">
      <div className="h-px flex-1 bg-border" />
      <TimestampTooltip date={date}>
        <span className="text-base font-medium text-muted-foreground">
          {formatTimelineDay(date)}
        </span>
      </TimestampTooltip>
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
    <div className="inline-flex rounded-md border border-border bg-background p-0.5 text-base">
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

// ---------------------------------------------------------------------------
// Top-level section. Owns filter state + builds the timeline + renders.
// Inter-item spacing uses Tailwind utilities directly rather than space-y on
// the parent so events / day-dividers / groups can use distinct gaps.
// ---------------------------------------------------------------------------

function gapClass(prev: RenderItem | undefined, curr: RenderItem): string {
  if (!prev) return "";
  // Day dividers carry their own padding internally.
  if (prev.kind === "day" || curr.kind === "day") return "";
  // Between two groups: comfortable gap.
  if (prev.kind === "group" && curr.kind === "group") return "mt-5";
  // Between a group and an event / terminal (and vice versa): tighter.
  if (
    (prev.kind === "group" &&
      (curr.kind === "event" || curr.kind === "terminal")) ||
    ((prev.kind === "event" || prev.kind === "terminal") &&
      curr.kind === "group")
  ) {
    return "mt-2.5";
  }
  // Between events: tight stack.
  if (prev.kind === "event" && curr.kind === "event") return "mt-1.5";
  // Group + terminal closing beat: a touch more breathing.
  if (prev.kind === "event" && curr.kind === "terminal") return "mt-2.5";
  return "mt-2";
}

export function TicketActivitySection({
  messages,
  events,
  highlightedMessageId = null,
}: {
  messages: TicketMessageView[];
  events: TicketEventView[];
  /** When set, the matching bubble renders with a primary-color ring.
   *  Driven by the QA section's supporting-message chip clicks. */
  highlightedMessageId?: string | null;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  if (messages.length === 0 && events.length === 0) return null;

  const items = buildTimeline(messages, events, filter);

  return (
    <DetailSection
      title="Activity"
      trailing={<ActivityFilter value={filter} onChange={setFilter} />}
    >
      <div>
        {items.map((it, i) => {
          const prev = i > 0 ? items[i - 1] : undefined;
          const gap = gapClass(prev, it);
          const wrap = (node: React.ReactNode, key: string) => (
            <div key={key} className={gap}>
              {node}
            </div>
          );
          if (it.kind === "day") {
            return wrap(
              <DayDivider date={it.date} />,
              `d-${it.date.toISOString()}-${i}`,
            );
          }
          if (it.kind === "event") {
            return wrap(<EventRow event={it.event} />, `e-${it.event.id}`);
          }
          if (it.kind === "terminal") {
            return wrap(
              <TerminalEventCard event={it.event} />,
              `t-${it.event.id}`,
            );
          }
          return wrap(
            <MessageGroup
              group={it}
              highlightedMessageId={highlightedMessageId}
            />,
            `g-${it.items[0].id}`,
          );
        })}
      </div>
    </DetailSection>
  );
}
