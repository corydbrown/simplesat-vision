"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  MessageSquarePlus,
  Sparkles,
  Star,
  Tag,
  Timer,
  UserPlus,
  X,
} from "lucide-react";
import {
  sampleTicket,
  type SampleCategory,
  type SampleMessage,
} from "@/lib/mockups/sample-data";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Cadence thresholds (email channel — arguable, tune here)                  */
/* -------------------------------------------------------------------------- */
/** Channel-aware thresholds. Email is a slower medium than live chat; pulses
 *  shouldn't flag a 12-min reply as bad. Reviewers — argue with these. */
const CADENCE_THRESHOLDS_MIN = {
  email: { green: 15, yellow: 60 },
  chat: { green: 2, yellow: 8 },
  phone: { green: 1, yellow: 3 },
  social: { green: 30, yellow: 240 },
} as const;

/* -------------------------------------------------------------------------- */
/*  Engineered timestamps — overrides on the sampleTicket messages so the     */
/*  cadence story reads at a glance: one fast lane, one borderline, one bad. */
/* -------------------------------------------------------------------------- */
const TIMESTAMP_OVERRIDES: Record<string, string> = {
  msg_1: "2026-05-20T14:02:00Z", // customer arrives
  msg_2: "2026-05-20T14:04:00Z", // agent picks up — 2 min, green
  msg_3: "2026-05-20T14:09:00Z", // agent diagnosis — 5 min, green
  msg_4: "2026-05-20T14:11:00Z", // customer reply — 2 min, green
  msg_5: "2026-05-20T14:38:00Z", // agent options — 27 min, yellow (took a beat to craft)
  msg_6: "2026-05-20T14:43:00Z", // customer chooses — 5 min, green
  msg_7: "2026-05-20T17:55:00Z", // agent confirms — 3h 12m, RED ("you let it sit too long")
  msg_8: "2026-05-20T18:01:00Z", // customer thanks — 6 min, green
};

/* -------------------------------------------------------------------------- */
/*  Activity events — Linear-style; shown when "Show activity" toggle is on  */
/* -------------------------------------------------------------------------- */
type ActivityEvent = {
  id: string;
  icon: "assign" | "tag" | "priority";
  text: string;
  /** ISO. Lives between two consecutive messages. */
  at: string;
};

const ACTIVITY_EVENTS: ActivityEvent[] = [
  {
    id: "act_1",
    icon: "assign",
    text: "Marisol assigned this ticket to herself",
    at: "2026-05-20T14:03:30Z",
  },
  {
    id: "act_2",
    icon: "tag",
    text: "AI added tag: shipping-issue",
    at: "2026-05-20T14:10:00Z",
  },
  {
    id: "act_3",
    icon: "priority",
    text: "Priority changed to High",
    at: "2026-05-20T14:15:00Z",
  },
];

/* -------------------------------------------------------------------------- */
/*  Category palette (matches sibling round-3 mockups)                        */
/* -------------------------------------------------------------------------- */
type Hue = "blue" | "green" | "yellow" | "purple" | "teal";

const CATEGORY_HUE: Record<string, Hue> = {
  cat_acknowledge: "blue",
  cat_diagnose: "green",
  cat_options: "yellow",
  cat_followthrough: "purple",
  cat_policy: "teal",
};

const HUE: Record<
  Hue,
  {
    text: string;
    textDark: string;
    bg: string;
    bgSoft: string;
    border: string;
    borderSoft: string;
    ring: string;
    stroke: string;
  }
> = {
  blue: {
    text: "text-blue-dark",
    textDark: "text-blue-darker",
    bg: "bg-blue",
    bgSoft: "bg-blue-lighter",
    border: "border-blue",
    borderSoft: "border-blue-light",
    ring: "ring-blue",
    stroke: "stroke-blue",
  },
  green: {
    text: "text-green-dark",
    textDark: "text-green-darker",
    bg: "bg-green",
    bgSoft: "bg-green-lighter",
    border: "border-green",
    borderSoft: "border-green-light",
    ring: "ring-green",
    stroke: "stroke-green",
  },
  yellow: {
    text: "text-yellow-dark",
    textDark: "text-yellow-darker",
    bg: "bg-yellow",
    bgSoft: "bg-yellow-lighter",
    border: "border-yellow",
    borderSoft: "border-yellow-light",
    ring: "ring-yellow",
    stroke: "stroke-yellow",
  },
  purple: {
    text: "text-purple-dark",
    textDark: "text-purple-darker",
    bg: "bg-purple",
    bgSoft: "bg-purple-lighter",
    border: "border-purple",
    borderSoft: "border-purple-light",
    ring: "ring-purple",
    stroke: "stroke-purple",
  },
  teal: {
    text: "text-teal-dark",
    textDark: "text-teal-darker",
    bg: "bg-teal",
    bgSoft: "bg-teal-lighter",
    border: "border-teal",
    borderSoft: "border-teal-light",
    ring: "ring-teal",
    stroke: "stroke-teal",
  },
};

/* -------------------------------------------------------------------------- */
/*  Cadence palette — separate axis from category hue                         */
/* -------------------------------------------------------------------------- */
type Cadence = "green" | "yellow" | "red";

const CADENCE: Record<
  Cadence,
  { bar: string; text: string; bgSoft: string; border: string; label: string }
> = {
  green: {
    bar: "bg-green",
    text: "text-green-darker",
    bgSoft: "bg-green-lighter",
    border: "border-green-light",
    label: "Within norm",
  },
  yellow: {
    bar: "bg-yellow",
    text: "text-yellow-darker",
    bgSoft: "bg-yellow-lighter",
    border: "border-yellow-light",
    label: "Borderline",
  },
  red: {
    bar: "bg-red",
    text: "text-red-darker",
    bgSoft: "bg-red-lighter",
    border: "border-red-light",
    label: "Slow",
  },
};

function classifyCadence(gapMin: number, channel: keyof typeof CADENCE_THRESHOLDS_MIN): Cadence {
  const t = CADENCE_THRESHOLDS_MIN[channel];
  if (gapMin <= t.green) return "green";
  if (gapMin <= t.yellow) return "yellow";
  return "red";
}

/** Short-form duration label tuned for inline use ("47 sec", "8 min", "3 hr 14 min"). */
function formatGap(ms: number): string {
  if (ms < 60_000) {
    const sec = Math.max(1, Math.round(ms / 1000));
    return `${sec} sec`;
  }
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 60) return `${totalMin} min`;
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/* -------------------------------------------------------------------------- */
/*  Citations + comments state                                                */
/* -------------------------------------------------------------------------- */
type Citation = {
  key: string;
  messageId: string;
  categoryId: string;
  aiSuggested: boolean;
};

function buildInitialCitations(categories: SampleCategory[]): Citation[] {
  const out: Citation[] = [];
  for (const cat of categories) {
    for (const msgId of cat.highlightedMessageIds) {
      out.push({
        key: `${msgId}::${cat.id}`,
        messageId: msgId,
        categoryId: cat.id,
        aiSuggested: true,
      });
    }
  }
  return out;
}

type Comment = {
  id: string;
  /** Either `msg:<id>` or `gap:<leftMsgId>-<rightMsgId>` or `act:<id>`. */
  target: string;
  body: string;
  authorName: string;
  createdAt: string;
};

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */
export default function PulseMockupPage() {
  const ticket = sampleTicket;
  const { evaluation } = ticket;
  const channel = ticket.channel as keyof typeof CADENCE_THRESHOLDS_MIN;

  // Apply timestamp overrides — the cadence story is engineered in this file.
  const messages: SampleMessage[] = useMemo(
    () =>
      ticket.messages.map((m) => ({
        ...m,
        createdAt: TIMESTAMP_OVERRIDES[m.id] ?? m.createdAt,
      })),
    [ticket.messages],
  );

  const [citations, setCitations] = useState<Citation[]>(() =>
    buildInitialCitations(evaluation.categories),
  );
  const [comments, setComments] = useState<Comment[]>([]);
  const [activityOn, setActivityOn] = useState(false);
  const [mutedCategoryId, setMutedCategoryId] = useState<string | null>(null);
  const [coachingOpen, setCoachingOpen] = useState(false);

  const citationsByMessage = useMemo(() => {
    const m = new Map<string, Citation[]>();
    for (const c of citations) {
      const arr = m.get(c.messageId) ?? [];
      arr.push(c);
      m.set(c.messageId, arr);
    }
    return m;
  }, [citations]);

  const citationsByCategory = useMemo(() => {
    const m = new Map<string, Citation[]>();
    for (const c of citations) {
      const arr = m.get(c.categoryId) ?? [];
      arr.push(c);
      m.set(c.categoryId, arr);
    }
    return m;
  }, [citations]);

  const commentsByTarget = useMemo(() => {
    const m = new Map<string, Comment[]>();
    for (const c of comments) {
      const arr = m.get(c.target) ?? [];
      arr.push(c);
      m.set(c.target, arr);
    }
    return m;
  }, [comments]);

  /** Messages cited under the muted category — these stay vivid. */
  const focusedMessageIds = useMemo(() => {
    if (!mutedCategoryId) return null;
    return new Set(
      (citationsByCategory.get(mutedCategoryId) ?? []).map((c) => c.messageId),
    );
  }, [mutedCategoryId, citationsByCategory]);

  function addCitation(messageId: string, categoryId: string) {
    setCitations((prev) => {
      if (prev.some((c) => c.messageId === messageId && c.categoryId === categoryId)) {
        return prev;
      }
      return [
        ...prev,
        { key: `${messageId}::${categoryId}`, messageId, categoryId, aiSuggested: false },
      ];
    });
  }

  function removeCitation(messageId: string, categoryId: string) {
    setCitations((prev) =>
      prev.filter((c) => !(c.messageId === messageId && c.categoryId === categoryId)),
    );
  }

  function addComment(target: string, body: string) {
    if (!body.trim()) return;
    setComments((prev) => [
      ...prev,
      {
        id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        target,
        body: body.trim(),
        authorName: "You",
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  return (
    <div className="relative">
      <div className="pr-[380px] transition-[padding] duration-300">
        <TicketHeader
          ticket={ticket}
          activityOn={activityOn}
          onToggleActivity={() => setActivityOn((v) => !v)}
        />
        <CadenceLegend channel={channel} />

        <div className="mt-4">
          {messages.map((msg, i) => {
            const prev = messages[i - 1];
            const gap = prev ? new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() : null;
            const cadence: Cadence | null =
              gap != null ? classifyCadence(gap / 60_000, channel) : null;

            // Are both bordering messages part of the focused category?
            const pulseFocused =
              focusedMessageIds == null
                ? true
                : !!(prev && focusedMessageIds.has(prev.id) && focusedMessageIds.has(msg.id));

            // Find any activities that fall inside this gap.
            const gapActivities = !prev
              ? []
              : ACTIVITY_EVENTS.filter((a) => {
                  const t = new Date(a.at).getTime();
                  return (
                    t > new Date(prev.createdAt).getTime() &&
                    t < new Date(msg.createdAt).getTime()
                  );
                });

            const gapKey = prev ? `gap:${prev.id}-${msg.id}` : null;

            return (
              <div key={msg.id}>
                {prev && cadence && gapKey && (
                  <PulseElement
                    cadence={cadence}
                    gapMs={gap!}
                    activities={activityOn ? gapActivities : []}
                    comments={commentsByTarget.get(gapKey) ?? []}
                    activityComments={Object.fromEntries(
                      gapActivities.map((a) => [
                        a.id,
                        commentsByTarget.get(`act:${a.id}`) ?? [],
                      ]),
                    )}
                    focused={pulseFocused}
                    onSubmitComment={(body) => addComment(gapKey, body)}
                    onSubmitActivityComment={(actId, body) =>
                      addComment(`act:${actId}`, body)
                    }
                  />
                )}
                <MessageRow
                  message={msg}
                  citations={citationsByMessage.get(msg.id) ?? []}
                  comments={commentsByTarget.get(`msg:${msg.id}`) ?? []}
                  dimmed={focusedMessageIds != null && !focusedMessageIds.has(msg.id)}
                  categories={evaluation.categories}
                  onAddCitation={addCitation}
                  onRemoveCitation={removeCitation}
                  onAddComment={(body) => addComment(`msg:${msg.id}`, body)}
                />
              </div>
            );
          })}
        </div>
      </div>

      <aside className="absolute right-0 top-0 z-20 w-[360px]">
        <div className="sticky top-4 space-y-3">
          <ScorePanelHeader
            score={evaluation.overallScore}
            confidence={evaluation.aiConfidence}
          />
          <div className="rounded-xl border border-border bg-card/95 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <span className="text-sm font-medium text-muted-foreground">
                Categories — click to focus
              </span>
              {mutedCategoryId && (
                <button
                  type="button"
                  onClick={() => setMutedCategoryId(null)}
                  className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
            <ul className="space-y-1.5 px-3 pb-3">
              {evaluation.categories.map((cat) => (
                <CategoryRow
                  key={cat.id}
                  category={cat}
                  active={mutedCategoryId === cat.id}
                  dimmed={mutedCategoryId !== null && mutedCategoryId !== cat.id}
                  citationCount={citationsByCategory.get(cat.id)?.length ?? 0}
                  onSelect={() =>
                    setMutedCategoryId((curr) => (curr === cat.id ? null : cat.id))
                  }
                />
              ))}
            </ul>

            <CadencePanel
              channel={channel}
              messages={messages}
            />

            <div className="border-t border-border">
              <button
                type="button"
                onClick={() => setCoachingOpen((v) => !v)}
                className="flex w-full cursor-pointer items-center justify-between px-4 py-2.5 text-base font-medium text-foreground transition-colors hover:bg-accent/50"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  Coaching
                </span>
                {coachingOpen ? (
                  <ChevronUp className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground" />
                )}
              </button>
              {coachingOpen && <CoachingBlock evaluation={evaluation} />}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Ticket header (with activity toggle)                                      */
/* -------------------------------------------------------------------------- */
function TicketHeader({
  ticket,
  activityOn,
  onToggleActivity,
}: {
  ticket: typeof sampleTicket;
  activityOn: boolean;
  onToggleActivity: () => void;
}) {
  return (
    <header className="mb-4 space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="font-mono">{ticket.externalId}</span>
        <span>·</span>
        <span className="capitalize">{ticket.channel}</span>
        <span>·</span>
        <span className="capitalize">{ticket.priority} priority</span>
      </div>
      <h1 className="text-2xl font-semibold leading-snug text-foreground">
        {ticket.subject}
      </h1>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-muted-foreground">
        <span className="text-foreground">{ticket.customer.name}</span>
        <span className="rounded-md bg-yellow-lighter px-1.5 py-0.5 text-sm font-medium capitalize text-yellow-darker">
          {ticket.customer.tier} tier
        </span>
        <span>·</span>
        <span>
          handled by <span className="text-foreground">{ticket.assignee.name}</span>
        </span>
        <span>·</span>
        <span className="capitalize">{ticket.status}</span>
      </div>

      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <Switch
          size="sm"
          checked={activityOn}
          onCheckedChange={onToggleActivity}
        />
        <span>Show activity</span>
      </label>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/*  Cadence legend (a quiet hint above the conversation)                       */
/* -------------------------------------------------------------------------- */
function CadenceLegend({
  channel,
}: {
  channel: keyof typeof CADENCE_THRESHOLDS_MIN;
}) {
  const t = CADENCE_THRESHOLDS_MIN[channel];
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-card/40 px-3 py-2 text-sm text-muted-foreground">
      <Timer className="size-4 text-muted-foreground" />
      <span>
        Cadence by channel (<span className="capitalize">{channel}</span>):
      </span>
      <LegendDot cadence="green" label={`≤ ${t.green} min`} />
      <LegendDot cadence="yellow" label={`${t.green}–${t.yellow} min`} />
      <LegendDot cadence="red" label={`> ${t.yellow} min`} />
    </div>
  );
}

function LegendDot({ cadence, label }: { cadence: Cadence; label: string }) {
  const c = CADENCE[cadence];
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("h-1.5 w-4 rounded-full", c.bar)} aria-hidden />
      <span>{label}</span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pulse element — the novel surface                                          */
/* -------------------------------------------------------------------------- */
function PulseElement({
  cadence,
  gapMs,
  activities,
  comments,
  activityComments,
  focused,
  onSubmitComment,
  onSubmitActivityComment,
}: {
  cadence: Cadence;
  gapMs: number;
  activities: ActivityEvent[];
  comments: Comment[];
  activityComments: Record<string, Comment[]>;
  focused: boolean;
  onSubmitComment: (body: string) => void;
  onSubmitActivityComment: (activityId: string, body: string) => void;
}) {
  const c = CADENCE[cadence];
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        "flex items-center gap-3 py-1.5 transition-opacity duration-300",
        focused ? "opacity-100" : "opacity-30",
      )}
      aria-label={`${formatGap(gapMs)} between messages`}
    >
      {/* spine indent so the pulse sits in the gutter between bubbles */}
      <div className="w-12 shrink-0" aria-hidden />

      <div className="flex flex-1 items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "group inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2 py-0.5 text-sm transition-all duration-200",
                "hover:-translate-y-px hover:shadow-md",
                c.bgSoft,
                c.border,
                c.text,
              )}
              aria-label={`Comment on ${formatGap(gapMs)} wait`}
            >
              <Clock className="size-3" />
              <span className="font-medium tabular-nums">{formatGap(gapMs)}</span>
              <span
                aria-hidden
                className={cn("h-1 w-10 rounded-full", c.bar)}
              />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="start"
            className="w-72"
          >
            <PopoverCommentInput
              title={`Comment on this ${formatGap(gapMs)} wait`}
              placeholder={
                cadence === "red"
                  ? "e.g. 'You let it sit too long — what happened here?'"
                  : "Add a note about this response time…"
              }
              onSubmit={(body) => {
                onSubmitComment(body);
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>

        {/* Activity events nested inside the gap, when enabled */}
        {activities.length > 0 && (
          <div className="flex flex-1 flex-col gap-1">
            {activities.map((a) => (
              <ActivityLine
                key={a.id}
                activity={a}
                comments={activityComments[a.id] ?? []}
                onSubmitComment={(body) => onSubmitActivityComment(a.id, body)}
              />
            ))}
          </div>
        )}
      </div>

      {comments.length > 0 && (
        <div className="ml-2 flex max-w-[60%] flex-col gap-1">
          {comments.map((cmt) => (
            <CommentCard key={cmt.id} comment={cmt} />
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Activity line (Linear-style, hoverable, commentable)                       */
/* -------------------------------------------------------------------------- */
function ActivityLine({
  activity,
  comments,
  onSubmitComment,
}: {
  activity: ActivityEvent;
  comments: Comment[];
  onSubmitComment: (body: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const Icon =
    activity.icon === "assign"
      ? UserPlus
      : activity.icon === "tag"
        ? Tag
        : Sparkles;
  return (
    <div className="flex flex-col gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground transition-all duration-200",
              "hover:-translate-y-px hover:bg-accent/40 hover:text-foreground hover:shadow-sm",
            )}
          >
            <Icon className="size-3.5" />
            <span className="italic">{activity.text}</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{formatTime(activity.at)}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" className="w-72">
          <PopoverCommentInput
            title="Comment on this activity"
            placeholder="Note something about this event…"
            onSubmit={(body) => {
              onSubmitComment(body);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {comments.length > 0 && (
        <div className="ml-6 flex flex-col gap-1">
          {comments.map((c) => (
            <CommentCard key={c.id} comment={c} />
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Message row — bubble + tabs + inline comments                              */
/* -------------------------------------------------------------------------- */
function MessageRow({
  message,
  citations,
  comments,
  dimmed,
  categories,
  onAddCitation,
  onRemoveCitation,
  onAddComment,
}: {
  message: SampleMessage;
  citations: Citation[];
  comments: Comment[];
  dimmed: boolean;
  categories: SampleCategory[];
  onAddCitation: (messageId: string, categoryId: string) => void;
  onRemoveCitation: (messageId: string, categoryId: string) => void;
  onAddComment: (body: string) => void;
}) {
  const isAgent = message.role === "agent";
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "comment" | "category">("menu");

  function close() {
    setOpen(false);
    setMode("menu");
  }

  return (
    <div
      className={cn(
        "flex gap-3 py-2 transition-opacity duration-300",
        isAgent ? "flex-row-reverse" : "flex-row",
        dimmed && "opacity-30",
      )}
    >
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
          isAgent
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground",
        )}
        aria-hidden
      >
        {message.authorName
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)}
      </div>
      <div
        className={cn(
          "max-w-[78%] flex-1 space-y-1",
          isAgent ? "items-end text-right" : "items-start",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 text-sm",
            isAgent ? "justify-end" : "justify-start",
          )}
        >
          <span className="font-medium text-foreground">{message.authorName}</span>
          <span className="text-muted-foreground">{formatTime(message.createdAt)}</span>
        </div>

        <Popover
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setMode("menu");
          }}
        >
          <PopoverTrigger asChild>
            <div
              className={cn(
                "relative inline-block cursor-pointer rounded-2xl border px-4 py-3 text-left text-base transition-all duration-200",
                "hover:-translate-y-px hover:shadow-md",
                isAgent
                  ? "rounded-tr-sm border-primary/20 bg-primary/10 text-foreground"
                  : "rounded-tl-sm border-border bg-card text-foreground",
              )}
            >
              {message.body}
            </div>
          </PopoverTrigger>
          <PopoverContent
            side={isAgent ? "left" : "right"}
            align="start"
            className="w-72"
          >
            {mode === "menu" && (
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setMode("comment")}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
                >
                  <MessageSquarePlus className="size-4" />
                  Add comment
                </button>
                <button
                  type="button"
                  onClick={() => setMode("category")}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
                >
                  <Sparkles className="size-4" />
                  Add to category
                </button>
              </div>
            )}
            {mode === "comment" && (
              <PopoverCommentInput
                title="Comment on this message"
                placeholder="What stands out here?"
                onSubmit={(body) => {
                  onAddComment(body);
                  close();
                }}
              />
            )}
            {mode === "category" && (
              <CategoryPicker
                categories={categories}
                existingCategoryIds={new Set(citations.map((c) => c.categoryId))}
                onPick={(catId) => {
                  onAddCitation(message.id, catId);
                  close();
                }}
              />
            )}
          </PopoverContent>
        </Popover>

        {citations.length > 0 && (
          <div
            className={cn(
              "flex flex-wrap gap-1.5 pt-1",
              isAgent ? "justify-end" : "justify-start",
            )}
          >
            {citations.map((c) => (
              <CitationTab
                key={c.key}
                citation={c}
                category={categories.find((cat) => cat.id === c.categoryId)!}
                onRemove={() => onRemoveCitation(c.messageId, c.categoryId)}
              />
            ))}
          </div>
        )}

        {comments.length > 0 && (
          <div
            className={cn(
              "flex flex-col gap-1 pt-1",
              isAgent ? "items-end" : "items-start",
            )}
          >
            {comments.map((cmt) => (
              <CommentCard key={cmt.id} comment={cmt} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Citation tab (under bubble)                                                */
/* -------------------------------------------------------------------------- */
function CitationTab({
  citation,
  category,
  onRemove,
}: {
  citation: Citation;
  category: SampleCategory;
  onRemove: () => void;
}) {
  const hue = CATEGORY_HUE[citation.categoryId];
  const styles = HUE[hue];
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-sm font-medium shadow-sm transition-all",
            "hover:-translate-y-px hover:shadow-md",
            styles.bgSoft,
            styles.borderSoft,
            styles.textDark,
          )}
          aria-label={`Cited under ${category.name}`}
        >
          <span className={cn("size-1.5 rounded-full", styles.bg)} aria-hidden />
          <span>{category.name}</span>
          {citation.aiSuggested && (
            <Sparkles className="size-3 opacity-80" aria-label="AI suggested" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-56">
        <div className="px-1 pb-1 text-sm font-medium text-foreground">
          {category.name}
        </div>
        <div className="px-1 text-sm text-muted-foreground">
          {category.scaleType === "binary"
            ? category.effectiveScore === 1
              ? "Pass"
              : "Fail"
            : `Current score: ${category.effectiveScore} / 5`}
        </div>
        <div className="my-1 border-t border-border" />
        <ChangeScore category={category} />
        <button
          type="button"
          onClick={() => {
            onRemove();
            setOpen(false);
          }}
          className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-red-darker transition-colors hover:bg-red-lighter"
        >
          <X className="size-4" />
          Remove citation
        </button>
      </PopoverContent>
    </Popover>
  );
}

function ChangeScore({ category }: { category: SampleCategory }) {
  // Local-only score override — no parent commit since this is a mockup.
  const [score, setScore] = useState<number>(category.effectiveScore);
  if (category.scaleType === "binary") {
    return (
      <div className="flex gap-1 px-1 py-1">
        {[1, 0].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setScore(v)}
            className={cn(
              "cursor-pointer rounded-md border px-2 py-1 text-sm transition-colors",
              score === v
                ? v === 1
                  ? "border-green bg-green-lighter text-green-darker"
                  : "border-red bg-red-lighter text-red-darker"
                : "border-border text-muted-foreground hover:bg-accent",
            )}
          >
            {v === 1 ? "Pass" : "Fail"}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      <span className="mr-1 text-sm text-muted-foreground">Score</span>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => setScore(n)}
          className={cn(
            "cursor-pointer rounded-md border px-2 py-0.5 text-sm tabular-nums transition-colors",
            n === score
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:bg-accent",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Popover sub-views                                                          */
/* -------------------------------------------------------------------------- */
function PopoverCommentInput({
  title,
  placeholder,
  onSubmit,
}: {
  title: string;
  placeholder: string;
  onSubmit: (body: string) => void;
}) {
  const [body, setBody] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <textarea
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
      />
      <div className="flex justify-end gap-1">
        <button
          type="button"
          onClick={() => onSubmit(body)}
          disabled={!body.trim()}
          className={cn(
            "rounded-md bg-primary px-2.5 py-1 text-sm font-medium text-primary-foreground transition-colors",
            body.trim()
              ? "cursor-pointer hover:bg-primary/90"
              : "cursor-not-allowed opacity-50",
          )}
        >
          Post
        </button>
      </div>
    </div>
  );
}

function CategoryPicker({
  categories,
  existingCategoryIds,
  onPick,
}: {
  categories: SampleCategory[];
  existingCategoryIds: Set<string>;
  onPick: (categoryId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="px-1 pb-1 text-sm font-medium text-foreground">
        Cite under
      </div>
      {categories.map((cat) => {
        const hue = CATEGORY_HUE[cat.id];
        const styles = HUE[hue];
        const already = existingCategoryIds.has(cat.id);
        return (
          <button
            key={cat.id}
            type="button"
            disabled={already}
            onClick={() => onPick(cat.id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
              already
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer hover:bg-accent",
            )}
          >
            <span className={cn("size-2 rounded-full", styles.bg)} aria-hidden />
            <span className="text-foreground">{cat.name}</span>
            {already && (
              <span className="ml-auto text-sm text-muted-foreground">
                Cited
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Comment card (small, attaches to any target)                               */
/* -------------------------------------------------------------------------- */
function CommentCard({ comment }: { comment: Comment }) {
  return (
    <div className="inline-flex max-w-full flex-col gap-0.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-left shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-center gap-1.5 text-sm">
        <span className="font-medium text-foreground">{comment.authorName}</span>
        <span className="text-muted-foreground">
          {formatTime(comment.createdAt)}
        </span>
      </div>
      <p className="text-sm text-foreground">{comment.body}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sidebar                                                                    */
/* -------------------------------------------------------------------------- */
function ScorePanelHeader({
  score,
  confidence,
}: {
  score: number;
  confidence: number;
}) {
  const scoreHue: Hue =
    score >= 90 ? "green" : score >= 75 ? "teal" : score >= 60 ? "yellow" : "purple";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur-md">
      <ScoreRing value={score} hue={scoreHue} />
      <div className="min-w-0 flex-1">
        <div className="text-sm text-muted-foreground">QA evaluation</div>
        <div className="text-base font-medium text-foreground">
          AI scored · {confidence}% confidence
        </div>
      </div>
    </div>
  );
}

function ScoreRing({ value, hue }: { value: number; hue: Hue }) {
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (value / 100) * circumference;
  const styles = HUE[hue];
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden>
      <circle cx="24" cy="24" r="18" fill="none" strokeWidth="4" className="stroke-border" />
      <circle
        cx="24"
        cy="24"
        r="18"
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 24 24)"
        className={cn("transition-[stroke-dashoffset] duration-700 ease-out", styles.stroke)}
      />
      <text
        x="24"
        y="24"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground text-base font-semibold"
        style={{ fontSize: "14px" }}
      >
        {value}
      </text>
    </svg>
  );
}

function CategoryRow({
  category,
  active,
  dimmed,
  citationCount,
  onSelect,
}: {
  category: SampleCategory;
  active: boolean;
  dimmed: boolean;
  citationCount: number;
  onSelect: () => void;
}) {
  const hue = CATEGORY_HUE[category.id];
  const styles = HUE[hue];
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "group relative w-full cursor-pointer overflow-hidden rounded-lg border px-3 py-2.5 text-left transition-all duration-200",
          active
            ? cn(styles.bgSoft, styles.border, "shadow-sm")
            : "border-transparent bg-transparent hover:bg-accent/50",
          dimmed && "opacity-50",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-2 left-0 w-1 rounded-r-full transition-all duration-200",
            styles.bg,
            active ? "opacity-100" : "opacity-0 group-hover:opacity-60",
          )}
        />
        <div className="flex items-center justify-between gap-2 pl-2">
          <span
            className={cn(
              "truncate text-base font-medium",
              active ? styles.textDark : "text-foreground",
            )}
          >
            {category.name}
          </span>
          <ScoreBadge category={category} hue={hue} />
        </div>
        <div className="mt-0.5 flex items-center gap-2 pl-2 text-sm text-muted-foreground">
          <span>{category.weightPercent}% weight</span>
          {category.isAutofail && (
            <>
              <span aria-hidden>·</span>
              <span className="font-medium text-red-darker">Autofail</span>
            </>
          )}
          <span aria-hidden>·</span>
          <span>
            {citationCount} cited
          </span>
        </div>
      </button>
    </li>
  );
}

function ScoreBadge({ category, hue }: { category: SampleCategory; hue: Hue }) {
  const styles = HUE[hue];
  if (category.scaleType === "binary") {
    return (
      <span
        className={cn(
          "shrink-0 rounded-md px-2 py-0.5 text-sm font-medium",
          styles.bgSoft,
          styles.textDark,
        )}
      >
        {category.effectiveScore === 1 ? "Pass" : "Fail"}
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "size-3 transition-colors",
            n <= category.effectiveScore
              ? cn(styles.text, "fill-current")
              : "text-border",
          )}
        />
      ))}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sidebar: Cadence panel — ticket-level pacing stats                         */
/* -------------------------------------------------------------------------- */
function CadencePanel({
  messages,
  channel,
}: {
  messages: SampleMessage[];
  channel: keyof typeof CADENCE_THRESHOLDS_MIN;
}) {
  const stats = useMemo(() => {
    const agentReplies: number[] = [];
    let longestMs = 0;
    for (let i = 1; i < messages.length; i++) {
      const prev = messages[i - 1];
      const curr = messages[i];
      const gap = new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime();
      if (gap > longestMs) longestMs = gap;
      if (curr.role === "agent" && prev.role !== "agent") {
        agentReplies.push(gap);
      }
    }
    const avgAgent =
      agentReplies.length > 0
        ? agentReplies.reduce((a, b) => a + b, 0) / agentReplies.length
        : 0;
    const totalMs =
      messages.length > 1
        ? new Date(messages[messages.length - 1].createdAt).getTime() -
          new Date(messages[0].createdAt).getTime()
        : 0;
    return { avgAgent, longestMs, totalMs };
  }, [messages]);

  const longestCadence = classifyCadence(stats.longestMs / 60_000, channel);
  const avgCadence = classifyCadence(stats.avgAgent / 60_000, channel);

  return (
    <div className="border-t border-border px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Timer className="size-3.5" />
        Cadence
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <Stat
          label="Avg agent reply"
          value={formatGap(stats.avgAgent)}
          cadence={avgCadence}
        />
        <Stat
          label="Longest gap"
          value={formatGap(stats.longestMs)}
          cadence={longestCadence}
        />
        <Stat
          label="Resolution"
          value={formatGap(stats.totalMs)}
        />
      </dl>
    </div>
  );
}

function Stat({
  label,
  value,
  cadence,
}: {
  label: string;
  value: string;
  cadence?: Cadence;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-base font-medium tabular-nums",
          cadence ? CADENCE[cadence].text : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Coaching block (shared shape with siblings)                                */
/* -------------------------------------------------------------------------- */
function CoachingBlock({
  evaluation,
}: {
  evaluation: typeof sampleTicket.evaluation;
}) {
  return (
    <div className="space-y-3 px-4 pb-4 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
      <div>
        <div className="mb-1 text-sm font-medium text-green-darker">Strengths</div>
        <ul className="space-y-1 text-base text-muted-foreground">
          {evaluation.coaching.strengthPoints.map((p) => (
            <li key={p} className="flex gap-1.5">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-green" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="mb-1 text-sm font-medium text-yellow-darker">Growth areas</div>
        <ul className="space-y-1 text-base text-muted-foreground">
          {evaluation.coaching.growthPoints.map((p) => (
            <li key={p} className="flex gap-1.5">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-yellow" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
