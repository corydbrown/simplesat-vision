"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CircleDot,
  MessageSquarePlus,
  Plus,
  Smile,
  Sparkles,
  Star,
  Tags,
  X,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  sampleTicket,
  type SampleCategory,
  type SampleMessage,
} from "@/lib/mockups/sample-data";
import { cn } from "@/lib/utils";

/* -------------------- Hues -------------------- */

type Hue = "blue" | "green" | "yellow" | "purple" | "teal" | "red";

const HUE: Record<
  Hue,
  {
    text: string;
    textDark: string;
    bg: string;
    bgSoft: string;
    border: string;
    borderSoft: string;
    borderMid: string;
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
    borderMid: "border-blue",
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
    borderMid: "border-green",
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
    borderMid: "border-yellow",
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
    borderMid: "border-purple",
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
    borderMid: "border-teal",
    ring: "ring-teal",
    stroke: "stroke-teal",
  },
  red: {
    text: "text-red-dark",
    textDark: "text-red-darker",
    bg: "bg-red",
    bgSoft: "bg-red-lighter",
    border: "border-red",
    borderSoft: "border-red-light",
    borderMid: "border-red",
    ring: "ring-red",
    stroke: "stroke-red",
  },
};

const CATEGORY_HUE: Record<string, Hue> = {
  // Agent (standard)
  cat_acknowledge: "blue",
  cat_diagnose: "green",
  cat_options: "yellow",
  cat_followthrough: "purple",
  cat_policy: "teal",
  // Customer (observational; outlined style)
  cust_frustration: "red",
  cust_confusion: "yellow",
  cust_resolution: "green",
  cust_escalation: "purple",
};

/* -------------------- Customer category set -------------------- */

type CustomerCategoryDef = {
  id: string;
  name: string;
  description: string;
};

const CUSTOMER_CATEGORIES: CustomerCategoryDef[] = [
  {
    id: "cust_frustration",
    name: "Frustration",
    description: "Customer expresses frustration or anger",
  },
  {
    id: "cust_confusion",
    name: "Confusion",
    description: "Customer is confused or asking clarifying questions",
  },
  {
    id: "cust_resolution",
    name: "Resolution moment",
    description: "Customer signals satisfaction or acceptance",
  },
  {
    id: "cust_escalation",
    name: "Escalation trigger",
    description: "Triggered (or should have triggered) escalation",
  },
];

const CUSTOMER_CATEGORY_BY_ID = new Map(
  CUSTOMER_CATEGORIES.map((c) => [c.id, c]),
);

/* -------------------- Types -------------------- */

type Citation = {
  key: string;
  messageId: string;
  categoryId: string;
  /** likert categories only. null = use the category's effectiveScore. */
  score: number | null;
  /** Customer-side observational tag (no score, outlined style). */
  isCustomer: boolean;
  aiSuggested: boolean;
};

type Comment = {
  id: string;
  author: string;
  initials: string;
  body: string;
  createdAt: string;
};

type Reaction = {
  id: string;
  messageId: string;
  emoji: string;
  reactorName: string;
  reactorInitials: string;
  /** Tailwind class for the reactor avatar background. */
  avatarColor: string;
  /** True if this is the current user — clicking the chip removes it. */
  isMine: boolean;
};

type ActivityEvent = {
  id: string;
  afterMessageId: string;
  label: string;
};

const QUICK_REACTIONS = ["❤️", "🔥", "👍", "👀", "✨", "😬"] as const;

const REACTOR_COLORS = [
  "bg-blue-light text-blue-darker",
  "bg-green-light text-green-darker",
  "bg-yellow-light text-yellow-darker",
  "bg-purple-light text-purple-darker",
  "bg-teal-light text-teal-darker",
  "bg-red-light text-red-darker",
];

/* -------------------- Seed data -------------------- */

const INITIAL_CITATIONS: Citation[] = (() => {
  const out: Citation[] = [];
  // Agent citations from the AI-scored evaluation.
  for (const cat of sampleTicket.evaluation.categories) {
    for (const msgId of cat.highlightedMessageIds) {
      out.push({
        key: `${msgId}::${cat.id}`,
        messageId: msgId,
        categoryId: cat.id,
        score: null,
        isCustomer: false,
        aiSuggested: true,
      });
    }
  }
  // Customer-side observational tags — seed to show the second-axis signal.
  const seedCustomer: Array<{ messageId: string; categoryId: string }> = [
    { messageId: "msg_1", categoryId: "cust_escalation" },
    { messageId: "msg_4", categoryId: "cust_frustration" },
    { messageId: "msg_6", categoryId: "cust_resolution" },
    { messageId: "msg_8", categoryId: "cust_resolution" },
  ];
  for (const { messageId, categoryId } of seedCustomer) {
    out.push({
      key: `${messageId}::${categoryId}`,
      messageId,
      categoryId,
      score: null,
      isCustomer: true,
      aiSuggested: true,
    });
  }
  return out;
})();

const INITIAL_COMMENTS: Record<string, Comment[]> = {
  msg_3: [
    {
      id: "c1",
      author: "Ana Rivera",
      initials: "AR",
      body: "Nice — the carrier-vs-fulfillment split is exactly how I want the team framing this.",
      createdAt: "2026-05-21T09:14:00Z",
    },
    {
      id: "c2",
      author: "Diego Park",
      initials: "DP",
      body: "Adding this to the new-hire playbook.",
      createdAt: "2026-05-21T11:02:00Z",
    },
  ],
  msg_5: [
    {
      id: "c3",
      author: "Ana Rivera",
      initials: "AR",
      body: "Two real options, tied to her deadline. This is the template.",
      createdAt: "2026-05-21T09:18:00Z",
    },
  ],
  msg_7: [
    {
      id: "c4",
      author: "Ana Rivera",
      initials: "AR",
      body: 'Tighten "within the hour" → wall-clock time. Otherwise excellent close.',
      createdAt: "2026-05-21T09:22:00Z",
    },
  ],
  msg_4: [
    {
      id: "c5",
      author: "Ana Rivera",
      initials: "AR",
      body: "She's anxious here — note the deadline pressure. Worth flagging in the next 1:1.",
      createdAt: "2026-05-21T09:25:00Z",
    },
  ],
};

const INITIAL_REACTIONS: Reaction[] = [
  {
    id: "r1",
    messageId: "msg_3",
    emoji: "❤️",
    reactorName: "Ana Rivera",
    reactorInitials: "AR",
    avatarColor: REACTOR_COLORS[0],
    isMine: false,
  },
  {
    id: "r2",
    messageId: "msg_3",
    emoji: "👀",
    reactorName: "Diego Park",
    reactorInitials: "DP",
    avatarColor: REACTOR_COLORS[1],
    isMine: false,
  },
  {
    id: "r3",
    messageId: "msg_5",
    emoji: "🔥",
    reactorName: "Ana Rivera",
    reactorInitials: "AR",
    avatarColor: REACTOR_COLORS[0],
    isMine: false,
  },
  {
    id: "r4",
    messageId: "msg_5",
    emoji: "🔥",
    reactorName: "Diego Park",
    reactorInitials: "DP",
    avatarColor: REACTOR_COLORS[1],
    isMine: false,
  },
  {
    id: "r5",
    messageId: "msg_5",
    emoji: "👍",
    reactorName: "Sam Okafor",
    reactorInitials: "SO",
    avatarColor: REACTOR_COLORS[2],
    isMine: false,
  },
  {
    id: "r6",
    messageId: "msg_7",
    emoji: "✨",
    reactorName: "Ana Rivera",
    reactorInitials: "AR",
    avatarColor: REACTOR_COLORS[0],
    isMine: false,
  },
  {
    id: "r7",
    messageId: "msg_8",
    emoji: "❤️",
    reactorName: "Ana Rivera",
    reactorInitials: "AR",
    avatarColor: REACTOR_COLORS[0],
    isMine: false,
  },
];

const ACTIVITIES: ActivityEvent[] = [
  {
    id: "act_1",
    afterMessageId: "msg_1",
    label: "Assigned to Marisol Tate (Front line)",
  },
  {
    id: "act_2",
    afterMessageId: "msg_2",
    label: "Marisol opened order BB-48721 in fulfillment console",
  },
  {
    id: "act_3",
    afterMessageId: "msg_5",
    label: 'Recovery offer template applied: "overnight reship"',
  },
  {
    id: "act_4",
    afterMessageId: "msg_7",
    label: "Discount code BLOOM-PS-15 generated · 15% off",
  },
];

/* -------------------- Format helpers -------------------- */

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelative(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* -------------------- Page -------------------- */

export default function ReactMockupPage() {
  const ticket = sampleTicket;
  const { evaluation, messages } = ticket;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [mutedCategoryId, setMutedCategoryId] = useState<string | null>(null);
  const [activityOn, setActivityOn] = useState(false);
  const [citations, setCitations] = useState<Citation[]>(INITIAL_CITATIONS);
  const [commentsByMsg, setCommentsByMsg] =
    useState<Record<string, Comment[]>>(INITIAL_COMMENTS);
  const [reactions, setReactions] = useState<Reaction[]>(INITIAL_REACTIONS);
  const [pendingComment, setPendingComment] = useState("");
  const [pickingScoreFor, setPickingScoreFor] = useState<{
    messageId: string;
    categoryId: string;
  } | null>(null);
  const [actionMenuFor, setActionMenuFor] = useState<string | null>(null);

  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const selected = selectedId
    ? (messages.find((m) => m.id === selectedId) ?? null)
    : null;

  const citationsByMessage = useMemo(() => {
    const m = new Map<string, Citation[]>();
    for (const c of citations) {
      const arr = m.get(c.messageId) ?? [];
      arr.push(c);
      m.set(c.messageId, arr);
    }
    return m;
  }, [citations]);

  const reactionsByMessage = useMemo(() => {
    const m = new Map<string, Reaction[]>();
    for (const r of reactions) {
      const arr = m.get(r.messageId) ?? [];
      arr.push(r);
      m.set(r.messageId, arr);
    }
    return m;
  }, [reactions]);

  const mutedCitedIds = useMemo(() => {
    if (!mutedCategoryId) return null;
    return new Set(
      citations
        .filter((c) => c.categoryId === mutedCategoryId)
        .map((c) => c.messageId),
    );
  }, [mutedCategoryId, citations]);

  const activityAfterMessage = useMemo(() => {
    const m = new Map<string, ActivityEvent[]>();
    for (const a of ACTIVITIES) {
      const arr = m.get(a.afterMessageId) ?? [];
      arr.push(a);
      m.set(a.afterMessageId, arr);
    }
    return m;
  }, []);

  /* -------------------- Actions -------------------- */

  function resetEphemerals() {
    setPickingScoreFor(null);
    setPendingComment("");
    setActionMenuFor(null);
  }

  const selectMessage = useCallback(
    (id: string) => {
      if (id !== selectedId) {
        setPickingScoreFor(null);
        setPendingComment("");
      }
      setActionMenuFor(null);
      setSelectedId(id);
      setFocusedId(id);
      setMutedCategoryId(null);
    },
    [selectedId],
  );

  const clearSelection = useCallback(() => {
    resetEphemerals();
    setSelectedId(null);
  }, []);

  function toggleMute(catId: string) {
    setMutedCategoryId((curr) => (curr === catId ? null : catId));
    // Auto-scroll first cited message to top of viewport.
    const cited = citations.find(
      (c) => c.categoryId === catId && !c.isCustomer,
    );
    if (cited) {
      const el = messageRefs.current.get(cited.messageId);
      if (el) {
        window.setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 40);
      }
    }
  }

  function removeCitation(messageId: string, categoryId: string) {
    setCitations((prev) =>
      prev.filter(
        (c) => !(c.messageId === messageId && c.categoryId === categoryId),
      ),
    );
  }

  function setCitationScore(
    messageId: string,
    categoryId: string,
    score: number,
  ) {
    setCitations((prev) =>
      prev.map((c) =>
        c.messageId === messageId && c.categoryId === categoryId
          ? { ...c, score }
          : c,
      ),
    );
    setPickingScoreFor(null);
  }

  function addCitation(
    messageId: string,
    categoryId: string,
    isCustomer: boolean,
  ) {
    setCitations((prev) => {
      if (
        prev.some(
          (c) => c.messageId === messageId && c.categoryId === categoryId,
        )
      ) {
        return prev;
      }
      return [
        ...prev,
        {
          key: `${messageId}::${categoryId}`,
          messageId,
          categoryId,
          score: null,
          isCustomer,
          aiSuggested: false,
        },
      ];
    });
    // One-click rate: open score picker immediately for likert (agent) cats.
    if (!isCustomer) {
      const cat = evaluation.categories.find((c) => c.id === categoryId);
      if (cat && cat.scaleType !== "binary") {
        setPickingScoreFor({ messageId, categoryId });
      } else {
        setPickingScoreFor(null);
      }
    } else {
      setPickingScoreFor(null);
    }
  }

  function submitComment() {
    if (!selectedId || !pendingComment.trim()) return;
    const next: Comment = {
      id: `c_${Date.now()}`,
      author: "You",
      initials: "YO",
      body: pendingComment.trim(),
      createdAt: new Date().toISOString(),
    };
    setCommentsByMsg((prev) => ({
      ...prev,
      [selectedId]: [...(prev[selectedId] ?? []), next],
    }));
    setPendingComment("");
  }

  function toggleReaction(messageId: string, emoji: string) {
    setReactions((prev) => {
      const mine = prev.find(
        (r) => r.messageId === messageId && r.emoji === emoji && r.isMine,
      );
      if (mine) {
        return prev.filter((r) => r.id !== mine.id);
      }
      return [
        ...prev,
        {
          id: `r_${Date.now()}`,
          messageId,
          emoji,
          reactorName: "You",
          reactorInitials: "YO",
          avatarColor: "bg-primary/15 text-primary",
          isMine: true,
        },
      ];
    });
  }

  /* -------------------- Keyboard navigation -------------------- */

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const inEditable =
        tag === "input" ||
        tag === "textarea" ||
        target?.isContentEditable === true;

      if (e.key === "Escape") {
        if (actionMenuFor) {
          setActionMenuFor(null);
          return;
        }
        if (selectedId) {
          clearSelection();
        } else if (mutedCategoryId) {
          setMutedCategoryId(null);
        }
        return;
      }

      if (inEditable) return;

      if (e.key === "Enter") {
        if (focusedId) {
          selectMessage(focusedId);
          e.preventDefault();
        }
        return;
      }

      const goDown = e.key === "ArrowDown" || e.key === "j";
      const goUp = e.key === "ArrowUp" || e.key === "k";
      if (!goDown && !goUp) return;
      e.preventDefault();

      const idx = focusedId
        ? messages.findIndex((m) => m.id === focusedId)
        : -1;
      const next =
        idx < 0
          ? goDown
            ? 0
            : messages.length - 1
          : goDown
            ? Math.min(messages.length - 1, idx + 1)
            : Math.max(0, idx - 1);
      const nextMsg = messages[next];
      if (!nextMsg) return;
      setFocusedId(nextMsg.id);
      const el = messageRefs.current.get(nextMsg.id);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    actionMenuFor,
    selectedId,
    focusedId,
    mutedCategoryId,
    messages,
    selectMessage,
    clearSelection,
  ]);

  /* -------------------- Render -------------------- */

  return (
    <div className="relative pb-16">
      <div className="pr-[400px] transition-[padding] duration-300">
        <TicketHeader ticket={ticket} />
        <ActivityToggle
          activityOn={activityOn}
          onToggle={() => setActivityOn((v) => !v)}
        />

        <div className="mt-4 space-y-3" onClick={clearSelection}>
          {messages.map((msg) => {
            const cits = citationsByMessage.get(msg.id) ?? [];
            const rxns = reactionsByMessage.get(msg.id) ?? [];
            const comments = commentsByMsg[msg.id] ?? [];
            const isSelected = selectedId === msg.id;
            const isFocused = focusedId === msg.id && !isSelected;
            const isMuted =
              (mutedCitedIds !== null && !mutedCitedIds.has(msg.id)) ||
              (selectedId !== null && selectedId !== msg.id);
            const outlineHue: Hue | null =
              mutedCitedIds && mutedCitedIds.has(msg.id)
                ? CATEGORY_HUE[mutedCategoryId!] || null
                : null;
            const activities = activityOn
              ? (activityAfterMessage.get(msg.id) ?? [])
              : [];
            return (
              <div key={msg.id}>
                <div
                  ref={(el) => {
                    if (el) messageRefs.current.set(msg.id, el);
                    else messageRefs.current.delete(msg.id);
                  }}
                >
                  <MessageBubble
                    message={msg}
                    citations={cits}
                    reactions={rxns}
                    commentCount={comments.length}
                    isSelected={isSelected}
                    isFocused={isFocused}
                    isMuted={isMuted}
                    outlineHue={outlineHue}
                    actionMenuOpen={actionMenuFor === msg.id}
                    pickingScoreFor={
                      pickingScoreFor && pickingScoreFor.messageId === msg.id
                        ? pickingScoreFor
                        : null
                    }
                    agentCategories={evaluation.categories}
                    onSelect={() => selectMessage(msg.id)}
                    onActionMenuOpenChange={(open) =>
                      setActionMenuFor(open ? msg.id : null)
                    }
                    onAddComment={() => {
                      selectMessage(msg.id);
                    }}
                    onAddCitation={(catId, isCustomer) =>
                      addCitation(msg.id, catId, isCustomer)
                    }
                    onPickScore={(catId, score) =>
                      setCitationScore(msg.id, catId, score)
                    }
                    onCancelScorePicker={() => setPickingScoreFor(null)}
                    onRemoveCitation={(catId) => removeCitation(msg.id, catId)}
                    onToggleReaction={(emoji) => toggleReaction(msg.id, emoji)}
                    onHoverFocus={() => setFocusedId(msg.id)}
                  />
                </div>
                {activities.map((a) => (
                  <ActivityRow key={a.id} event={a} dimmed={isMuted} />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <aside className="absolute right-0 top-0 z-20 w-[380px]">
        <div className="sticky top-4">
          {selected ? (
            <InspectPanel
              ticket={ticket}
              message={selected}
              citations={citationsByMessage.get(selected.id) ?? []}
              comments={commentsByMsg[selected.id] ?? []}
              reactions={reactionsByMessage.get(selected.id) ?? []}
              pickingScoreFor={pickingScoreFor}
              pendingComment={pendingComment}
              onClose={clearSelection}
              onRemoveCitation={(catId) =>
                removeCitation(selected.id, catId)
              }
              onStartChangeScore={(catId) =>
                setPickingScoreFor((curr) =>
                  curr &&
                  curr.messageId === selected.id &&
                  curr.categoryId === catId
                    ? null
                    : { messageId: selected.id, categoryId: catId },
                )
              }
              onPickScore={(catId, score) =>
                setCitationScore(selected.id, catId, score)
              }
              onAddCitation={(catId, isCustomer) =>
                addCitation(selected.id, catId, isCustomer)
              }
              onToggleReaction={(emoji) =>
                toggleReaction(selected.id, emoji)
              }
              onPendingCommentChange={setPendingComment}
              onSubmitComment={submitComment}
            />
          ) : (
            <OverviewPanel
              evaluation={evaluation}
              mutedCategoryId={mutedCategoryId}
              onToggleMute={toggleMute}
            />
          )}
        </div>
      </aside>

      <KeyboardHintBar />
    </div>
  );
}

/* -------------------- Header + activity toggle -------------------- */

function TicketHeader({ ticket }: { ticket: typeof sampleTicket }) {
  return (
    <header className="mb-4 space-y-3" onClick={(e) => e.stopPropagation()}>
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
          handled by{" "}
          <span className="text-foreground">{ticket.assignee.name}</span>
        </span>
        <span>·</span>
        <span className="capitalize">{ticket.status}</span>
      </div>
    </header>
  );
}

function ActivityToggle({
  activityOn,
  onToggle,
}: {
  activityOn: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between rounded-lg border border-dashed border-border bg-card/40 px-3 py-2"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="size-4 text-primary" />
        <span>
          Hover a bubble to react. Click for the action menu. Enter inspects.
          Both sides of the convo can be tagged.
        </span>
      </div>
      <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <span>Show activity</span>
        <Switch checked={activityOn} onCheckedChange={onToggle} />
      </label>
    </div>
  );
}

function ActivityRow({
  event,
  dimmed,
}: {
  event: ActivityEvent;
  dimmed: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 py-1.5 text-sm text-muted-foreground transition-opacity duration-300 animate-in fade-in",
        dimmed && "opacity-30",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="h-px flex-1 bg-border" />
      <div className="flex items-center gap-1.5">
        <CircleDot className="size-3" />
        <span>{event.label}</span>
      </div>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

/* -------------------- Message bubble -------------------- */

function MessageBubble({
  message,
  citations,
  reactions,
  commentCount,
  isSelected,
  isFocused,
  isMuted,
  outlineHue,
  actionMenuOpen,
  pickingScoreFor,
  agentCategories,
  onSelect,
  onActionMenuOpenChange,
  onAddComment,
  onAddCitation,
  onPickScore,
  onCancelScorePicker,
  onRemoveCitation,
  onToggleReaction,
  onHoverFocus,
}: {
  message: SampleMessage;
  citations: Citation[];
  reactions: Reaction[];
  commentCount: number;
  isSelected: boolean;
  isFocused: boolean;
  isMuted: boolean;
  outlineHue: Hue | null;
  actionMenuOpen: boolean;
  pickingScoreFor: { messageId: string; categoryId: string } | null;
  agentCategories: SampleCategory[];
  onSelect: () => void;
  onActionMenuOpenChange: (open: boolean) => void;
  onAddComment: () => void;
  onAddCitation: (categoryId: string, isCustomer: boolean) => void;
  onPickScore: (categoryId: string, score: number) => void;
  onCancelScorePicker: () => void;
  onRemoveCitation: (categoryId: string) => void;
  onToggleReaction: (emoji: string) => void;
  onHoverFocus: () => void;
}) {
  const isAgent = message.role === "agent";
  const [hovered, setHovered] = useState(false);
  const trayVisible = hovered || actionMenuOpen;

  // Group reactions by emoji for chip rendering.
  const reactionGroups = useMemo(() => {
    const m = new Map<string, Reaction[]>();
    for (const r of reactions) {
      const arr = m.get(r.emoji) ?? [];
      arr.push(r);
      m.set(r.emoji, arr);
    }
    return Array.from(m.entries());
  }, [reactions]);

  const activeScorePicker =
    pickingScoreFor && pickingScoreFor.messageId === message.id
      ? pickingScoreFor
      : null;

  return (
    <div
      className={cn(
        "flex gap-3 transition-all duration-300 ease-out",
        isAgent ? "flex-row-reverse" : "flex-row",
        isMuted && "opacity-30 blur-[0.5px]",
      )}
      onMouseEnter={() => {
        setHovered(true);
        onHoverFocus();
      }}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => e.stopPropagation()}
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
          <span className="font-medium text-foreground">
            {message.authorName}
          </span>
          <span className="text-muted-foreground">
            {formatTime(message.createdAt)}
          </span>
        </div>

        <div className={cn("relative", isAgent ? "inline-block" : "inline-block")}>
          <Popover open={actionMenuOpen} onOpenChange={onActionMenuOpenChange}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "relative inline-block max-w-full cursor-pointer rounded-2xl border px-4 py-3 text-left text-base transition-all duration-200 ease-out",
                  isAgent
                    ? "rounded-tr-sm border-primary/20 bg-primary/10 text-foreground"
                    : "rounded-tl-sm border-border bg-card text-foreground",
                  "hover:-translate-y-px hover:shadow-md",
                  isSelected &&
                    "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg -translate-y-px",
                  isFocused &&
                    !isSelected &&
                    "ring-1 ring-muted-foreground/40 ring-offset-2 ring-offset-background",
                  outlineHue &&
                    !isSelected &&
                    cn(
                      "ring-2 ring-offset-2 ring-offset-background",
                      HUE[outlineHue].ring,
                    ),
                )}
              >
                {message.body}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align={isAgent ? "end" : "start"}
              side="bottom"
              sideOffset={8}
              className="w-72 p-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <BubbleActionMenu
                message={message}
                citations={citations}
                agentCategories={agentCategories}
                activeScorePicker={activeScorePicker}
                onAddComment={() => {
                  onActionMenuOpenChange(false);
                  onAddComment();
                }}
                onAddCitation={onAddCitation}
                onPickScore={onPickScore}
                onCancelScorePicker={onCancelScorePicker}
                onToggleReaction={(emoji) => {
                  onToggleReaction(emoji);
                  onActionMenuOpenChange(false);
                }}
                onInspect={() => {
                  onActionMenuOpenChange(false);
                  onSelect();
                }}
              />
            </PopoverContent>
          </Popover>

          {/* Reaction tray — slides up below the bubble on hover. */}
          <ReactionTray
            visible={trayVisible}
            isAgent={isAgent}
            existingMine={new Set(
              reactions.filter((r) => r.isMine).map((r) => r.emoji),
            )}
            onPick={onToggleReaction}
          />
        </div>

        {/* Chips row — category tabs, reaction chips, comment count. */}
        <ChipsRow
          isAgent={isAgent}
          citations={citations}
          reactionGroups={reactionGroups}
          commentCount={commentCount}
          agentCategories={agentCategories}
          onRemoveCitation={onRemoveCitation}
          onToggleReaction={onToggleReaction}
        />
      </div>
    </div>
  );
}

/* -------------------- Bubble action menu -------------------- */

function BubbleActionMenu({
  message,
  citations,
  agentCategories,
  activeScorePicker,
  onAddComment,
  onAddCitation,
  onPickScore,
  onCancelScorePicker,
  onToggleReaction,
  onInspect,
}: {
  message: SampleMessage;
  citations: Citation[];
  agentCategories: SampleCategory[];
  activeScorePicker: { messageId: string; categoryId: string } | null;
  onAddComment: () => void;
  onAddCitation: (categoryId: string, isCustomer: boolean) => void;
  onPickScore: (categoryId: string, score: number) => void;
  onCancelScorePicker: () => void;
  onToggleReaction: (emoji: string) => void;
  onInspect: () => void;
}) {
  const [explicitView, setExplicitView] = useState<"root" | "categorize">(
    "root",
  );
  const isCustomer = message.role === "customer";
  // Score picker activation jumps into categorize view automatically.
  const view: "root" | "categorize" = activeScorePicker
    ? "categorize"
    : explicitView;
  const setView = setExplicitView;

  const citedIds = new Set(citations.map((c) => c.categoryId));

  if (view === "categorize") {
    const cats = isCustomer
      ? CUSTOMER_CATEGORIES.map((c) => ({
          id: c.id,
          name: c.name,
          hue: CATEGORY_HUE[c.id],
          isCustomer: true,
          scale: "observational" as const,
        }))
      : agentCategories.map((c) => ({
          id: c.id,
          name: c.name,
          hue: CATEGORY_HUE[c.id],
          isCustomer: false,
          scale: c.scaleType,
        }));

    return (
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2 px-2 pt-1">
          <span className="text-sm font-medium text-muted-foreground">
            {isCustomer ? "Customer signal" : "Add to category"}
          </span>
          <button
            type="button"
            onClick={() => {
              setView("root");
              onCancelScorePicker();
            }}
            className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Back
          </button>
        </div>
        <ul className="space-y-0.5">
          {cats.map((c) => {
            const already = citedIds.has(c.id);
            const styles = HUE[c.hue];
            const isPickingHere =
              activeScorePicker &&
              activeScorePicker.categoryId === c.id &&
              !c.isCustomer &&
              c.scale === "likert_5";
            return (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={already && !isPickingHere}
                  onClick={() => {
                    if (already) return;
                    onAddCitation(c.id, c.isCustomer);
                    if (c.isCustomer || c.scale === "binary") {
                      // Close picker view; no score step.
                      setView("root");
                    }
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-base transition-colors",
                    already && !isPickingHere
                      ? "cursor-not-allowed opacity-50"
                      : "cursor-pointer hover:bg-accent",
                  )}
                >
                  <span
                    className={cn(
                      c.isCustomer
                        ? cn(
                            "size-2 rounded-full border",
                            styles.borderMid,
                          )
                        : cn("size-2 rounded-full", styles.bg),
                    )}
                    aria-hidden
                  />
                  <span className="flex-1 truncate text-foreground">
                    {c.name}
                  </span>
                  {already && (
                    <span className="text-sm text-muted-foreground">cited</span>
                  )}
                </button>
                {isPickingHere && (
                  <div className="mt-1 flex items-center gap-1 px-2 pb-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                    <span className="text-sm text-muted-foreground">
                      Score:
                    </span>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => onPickScore(c.id, n)}
                        className={cn(
                          "size-7 cursor-pointer rounded-md border text-sm font-medium tabular-nums transition-all",
                          "border-border bg-background hover:scale-105",
                          styles.textDark,
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 px-1.5 pt-1">
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onToggleReaction(emoji)}
            className="flex size-8 cursor-pointer items-center justify-center rounded-md text-base transition-all hover:scale-110 hover:bg-accent"
            aria-label={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
      <div className="my-1 border-t border-border" />
      <ul className="space-y-0.5">
        <ActionMenuItem
          icon={<MessageSquarePlus className="size-4" />}
          label="Add comment"
          shortcut="⏎"
          onClick={onAddComment}
        />
        <ActionMenuItem
          icon={<Tags className="size-4" />}
          label={isCustomer ? "Tag customer signal" : "Add to category"}
          onClick={() => setView("categorize")}
        />
        <ActionMenuItem
          icon={<Sparkles className="size-4" />}
          label="Inspect"
          onClick={onInspect}
        />
      </ul>
    </div>
  );
}

function ActionMenuItem({
  icon,
  label,
  shortcut,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-base text-foreground transition-colors hover:bg-accent"
      >
        <span className="text-muted-foreground">{icon}</span>
        <span className="flex-1">{label}</span>
        {shortcut && (
          <kbd className="rounded border border-border bg-background px-1 font-mono text-xs text-muted-foreground">
            {shortcut}
          </kbd>
        )}
      </button>
    </li>
  );
}

/* -------------------- Reaction tray -------------------- */

function ReactionTray({
  visible,
  isAgent,
  existingMine,
  onPick,
}: {
  visible: boolean;
  isAgent: boolean;
  existingMine: Set<string>;
  onPick: (emoji: string) => void;
}) {
  return (
    <div
      className={cn(
        "absolute z-10 flex items-center gap-0.5 rounded-full border border-border bg-popover px-1 py-0.5 shadow-md transition-all duration-150",
        "-bottom-4",
        isAgent ? "right-3" : "left-3",
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-1 pointer-events-none",
      )}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {QUICK_REACTIONS.map((emoji) => {
        const mine = existingMine.has(emoji);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onPick(emoji)}
            aria-label={`React with ${emoji}`}
            className={cn(
              "flex size-7 cursor-pointer items-center justify-center rounded-full text-base transition-transform hover:scale-125",
              mine && "bg-accent",
            )}
          >
            {emoji}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------- Chips row -------------------- */

function ChipsRow({
  isAgent,
  citations,
  reactionGroups,
  commentCount,
  agentCategories,
  onRemoveCitation,
  onToggleReaction,
}: {
  isAgent: boolean;
  citations: Citation[];
  reactionGroups: Array<[string, Reaction[]]>;
  commentCount: number;
  agentCategories: SampleCategory[];
  onRemoveCitation: (categoryId: string) => void;
  onToggleReaction: (emoji: string) => void;
}) {
  if (
    citations.length === 0 &&
    reactionGroups.length === 0 &&
    commentCount === 0
  ) {
    return null;
  }
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 pt-2",
        isAgent ? "justify-end" : "justify-start",
      )}
    >
      {citations.map((c) => (
        <CategoryTab
          key={c.key}
          citation={c}
          agentCategories={agentCategories}
          onRemove={() => onRemoveCitation(c.categoryId)}
        />
      ))}
      {reactionGroups.map(([emoji, group]) => (
        <ReactionChip
          key={emoji}
          emoji={emoji}
          group={group}
          onClick={() => onToggleReaction(emoji)}
        />
      ))}
      {commentCount > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-sm text-muted-foreground">
          <MessageSquarePlus className="size-3" />
          <span>{commentCount}</span>
        </span>
      )}
    </div>
  );
}

function CategoryTab({
  citation,
  agentCategories,
  onRemove,
}: {
  citation: Citation;
  agentCategories: SampleCategory[];
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hue = CATEGORY_HUE[citation.categoryId];
  const styles = HUE[hue];

  const name = citation.isCustomer
    ? (CUSTOMER_CATEGORY_BY_ID.get(citation.categoryId)?.name ??
      citation.categoryId)
    : (agentCategories.find((c) => c.id === citation.categoryId)?.name ??
      citation.categoryId);

  const category = citation.isCustomer
    ? null
    : agentCategories.find((c) => c.id === citation.categoryId);
  const effectiveScore =
    category && category.scaleType === "likert_5"
      ? (citation.score ?? category.effectiveScore)
      : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-sm font-medium shadow-sm transition-all hover:-translate-y-px hover:shadow-md",
            citation.isCustomer
              ? cn("bg-background", styles.borderMid, styles.textDark)
              : cn(styles.bgSoft, styles.borderSoft, styles.textDark),
          )}
          title={
            citation.isCustomer
              ? `Customer signal · ${name}`
              : `${name}${effectiveScore != null ? ` · ${effectiveScore}/5` : ""}`
          }
        >
          <span
            className={cn(
              citation.isCustomer
                ? cn("size-1.5 rounded-full border", styles.border)
                : cn("size-1.5 rounded-full", styles.bg),
            )}
            aria-hidden
          />
          <span>{name}</span>
          {effectiveScore != null && (
            <span className={cn("text-sm tabular-nums", styles.text)}>
              {effectiveScore}/5
            </span>
          )}
          {citation.aiSuggested && (
            <Sparkles className="size-3 opacity-70" aria-hidden />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1.5" align="start">
        <div className="px-2 pb-1.5 pt-1 text-sm font-medium text-muted-foreground">
          {name}
          {citation.isCustomer && (
            <span className="ml-1 text-sm text-muted-foreground">
              · customer signal
            </span>
          )}
        </div>
        {category && category.scaleType === "likert_5" && (
          <ScorePickerInline
            currentScore={effectiveScore ?? category.effectiveScore}
            hue={hue}
            onPick={(score) => {
              setOpen(false);
              // Score change handled by parent via separate flow — for simplicity,
              // this popover only exposes Remove. The sidebar "Change" is the
              // canonical re-score path. (Brief: never one-click destroy.)
              void score;
            }}
            disabled
          />
        )}
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onRemove();
          }}
          className={cn(
            "mt-1 flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
            "text-red-darker hover:bg-red-lighter",
          )}
        >
          <X className="size-3.5" />
          <span>Remove</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}

function ScorePickerInline({
  currentScore,
  hue,
  onPick,
  disabled,
}: {
  currentScore: number;
  hue: Hue;
  onPick: (score: number) => void;
  disabled?: boolean;
}) {
  const styles = HUE[hue];
  return (
    <div className="flex items-center gap-1 px-2 pb-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onPick(n)}
          className={cn(
            "size-7 rounded-md border text-sm font-medium tabular-nums transition-all",
            n === currentScore
              ? cn(styles.bg, "border-transparent text-white shadow-sm")
              : cn(
                  "border-border bg-background hover:scale-105",
                  styles.textDark,
                ),
            disabled && "cursor-not-allowed opacity-60",
            !disabled && "cursor-pointer",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function ReactionChip({
  emoji,
  group,
  onClick,
}: {
  emoji: string;
  group: Reaction[];
  onClick: () => void;
}) {
  const mine = group.some((r) => r.isMine);
  const names = group.map((r) => r.reactorName);
  const tooltipText =
    names.length === 1
      ? `${names[0]} reacted with ${emoji}`
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} reacted with ${emoji}`;
  return (
    <div className="group/chip relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1 rounded-full border px-1.5 py-0.5 text-sm transition-all hover:-translate-y-px hover:shadow-md",
          mine
            ? "border-primary/30 bg-primary/10"
            : "border-border bg-muted/60",
        )}
      >
        <span className="text-base leading-none">{emoji}</span>
        <span className="font-medium text-foreground tabular-nums">
          {group.length}
        </span>
        <ReactorStack reactors={group} />
      </button>
      <div className="pointer-events-none absolute -top-9 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-sm text-foreground opacity-0 shadow-md transition-opacity group-hover/chip:opacity-100">
        {tooltipText}
      </div>
    </div>
  );
}

function ReactorStack({ reactors }: { reactors: Reaction[] }) {
  const visible = reactors.slice(0, 3);
  const extra = reactors.length - visible.length;
  return (
    <span className="flex -space-x-1.5">
      {visible.map((r) => (
        <span
          key={r.id}
          className={cn(
            "flex size-4 items-center justify-center rounded-full border border-background text-[10px] font-semibold",
            r.avatarColor,
          )}
          aria-hidden
        >
          {r.reactorInitials}
        </span>
      ))}
      {extra > 0 && (
        <span className="flex size-4 items-center justify-center rounded-full border border-background bg-muted text-[10px] font-semibold text-muted-foreground">
          +{extra}
        </span>
      )}
    </span>
  );
}

/* -------------------- Overview panel -------------------- */

function OverviewPanel({
  evaluation,
  mutedCategoryId,
  onToggleMute,
}: {
  evaluation: typeof sampleTicket.evaluation;
  mutedCategoryId: string | null;
  onToggleMute: (id: string) => void;
}) {
  const scoreHue: Hue =
    evaluation.overallScore >= 90
      ? "green"
      : evaluation.overallScore >= 75
        ? "teal"
        : evaluation.overallScore >= 60
          ? "yellow"
          : "purple";
  return (
    <div
      className="rounded-xl border border-border bg-card/95 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-right-2 duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-3 p-4">
        <ScoreRing value={evaluation.overallScore} hue={scoreHue} />
        <div className="min-w-0 flex-1">
          <div className="text-sm text-muted-foreground">QA evaluation</div>
          <div className="text-base font-medium text-foreground">
            AI scored · {evaluation.aiConfidence}% confidence
          </div>
        </div>
      </div>
      <div className="border-t border-border" />
      <div className="p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-sm font-medium text-muted-foreground">
            Categories
          </span>
          {mutedCategoryId && (
            <button
              type="button"
              onClick={() => onToggleMute(mutedCategoryId)}
              className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
        <ul className="space-y-1.5">
          {evaluation.categories.map((cat) => (
            <CategoryRow
              key={cat.id}
              category={cat}
              active={mutedCategoryId === cat.id}
              dimmed={
                mutedCategoryId !== null && mutedCategoryId !== cat.id
              }
              onToggle={() => onToggleMute(cat.id)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function CategoryRow({
  category,
  active,
  dimmed,
  onToggle,
}: {
  category: SampleCategory;
  active: boolean;
  dimmed: boolean;
  onToggle: () => void;
}) {
  const hue = CATEGORY_HUE[category.id];
  const styles = HUE[hue];
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
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
          <span>{category.highlightedMessageIds.length} cited</span>
        </div>
        {active && (
          <p className="mt-2 pl-2 text-base text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-200">
            {category.aiReasoning}
          </p>
        )}
      </button>
    </li>
  );
}

function ScoreBadge({
  category,
  hue,
}: {
  category: SampleCategory;
  hue: Hue;
}) {
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

function ScoreRing({ value, hue }: { value: number; hue: Hue }) {
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (value / 100) * circumference;
  const styles = HUE[hue];
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden>
      <circle
        cx="24"
        cy="24"
        r="18"
        fill="none"
        strokeWidth="4"
        className="stroke-border"
      />
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
        className={cn(
          "transition-[stroke-dashoffset] duration-700 ease-out",
          styles.stroke,
        )}
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

/* -------------------- Inspect panel -------------------- */

function InspectPanel({
  ticket,
  message,
  citations,
  comments,
  reactions,
  pickingScoreFor,
  pendingComment,
  onClose,
  onRemoveCitation,
  onStartChangeScore,
  onPickScore,
  onAddCitation,
  onToggleReaction,
  onPendingCommentChange,
  onSubmitComment,
}: {
  ticket: typeof sampleTicket;
  message: SampleMessage;
  citations: Citation[];
  comments: Comment[];
  reactions: Reaction[];
  pickingScoreFor: { messageId: string; categoryId: string } | null;
  pendingComment: string;
  onClose: () => void;
  onRemoveCitation: (categoryId: string) => void;
  onStartChangeScore: (categoryId: string) => void;
  onPickScore: (categoryId: string, score: number) => void;
  onAddCitation: (categoryId: string, isCustomer: boolean) => void;
  onToggleReaction: (emoji: string) => void;
  onPendingCommentChange: (s: string) => void;
  onSubmitComment: () => void;
}) {
  const { evaluation } = ticket;
  const isCustomer = message.role === "customer";
  const [adding, setAdding] = useState(false);

  const citedIds = new Set(citations.map((c) => c.categoryId));
  const availableAgent = evaluation.categories.filter(
    (c) => !citedIds.has(c.id),
  );
  const availableCustomer = CUSTOMER_CATEGORIES.filter(
    (c) => !citedIds.has(c.id),
  );

  return (
    <div
      className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-card/95 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-right-2 duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 border-b border-border bg-background/40 px-3 py-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to overview"
          className="flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          <span>Back</span>
        </button>
        <span className="ml-auto truncate text-sm text-muted-foreground">
          {message.authorName} · {formatTime(message.createdAt)}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-5 p-4">
          {/* Citations */}
          <section>
            <SectionHeader
              label={isCustomer ? "Signals" : "Citations"}
              hint={
                citations.length === 0
                  ? "Not tagged yet."
                  : `${citations.length} ${citations.length === 1 ? "tag" : "tags"}`
              }
            />
            <div className="space-y-1.5">
              {citations.map((c) => {
                const cat = c.isCustomer
                  ? CUSTOMER_CATEGORY_BY_ID.get(c.categoryId)
                  : evaluation.categories.find((x) => x.id === c.categoryId);
                if (!cat) return null;
                return (
                  <CitationRow
                    key={c.key}
                    citation={c}
                    agentCategory={
                      c.isCustomer
                        ? null
                        : (cat as SampleCategory)
                    }
                    customerCategory={
                      c.isCustomer ? (cat as CustomerCategoryDef) : null
                    }
                    isChangingScore={
                      pickingScoreFor !== null &&
                      pickingScoreFor.categoryId === c.categoryId
                    }
                    onStartChangeScore={() =>
                      onStartChangeScore(c.categoryId)
                    }
                    onPickScore={(s) => onPickScore(c.categoryId, s)}
                    onRemove={() => onRemoveCitation(c.categoryId)}
                  />
                );
              })}

              {adding ? (
                <AddPicker
                  isCustomer={isCustomer}
                  availableAgent={availableAgent}
                  availableCustomer={availableCustomer}
                  onPick={(catId, isCust) => {
                    onAddCitation(catId, isCust);
                    setAdding(false);
                  }}
                  onCancel={() => setAdding(false)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  disabled={
                    (isCustomer ? availableCustomer : availableAgent)
                      .length === 0
                  }
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/40",
                    "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
                  )}
                >
                  <Plus className="size-3.5" />
                  {isCustomer
                    ? availableCustomer.length === 0
                      ? "All customer signals tagged"
                      : "Tag customer signal…"
                    : availableAgent.length === 0
                      ? "Cited under every category"
                      : "Add to category…"}
                </button>
              )}
            </div>
          </section>

          {/* Reactions hub */}
          <section>
            <SectionHeader
              label="Reactions"
              hint={
                reactions.length === 0
                  ? undefined
                  : `${reactions.length} ${reactions.length === 1 ? "reaction" : "reactions"}`
              }
            />
            <ReactionsHub
              reactions={reactions}
              onPick={onToggleReaction}
            />
          </section>

          {/* Comments */}
          <section>
            <SectionHeader
              label="Comments"
              hint={
                comments.length === 0
                  ? undefined
                  : `${comments.length} ${comments.length === 1 ? "comment" : "comments"}`
              }
            />
            {comments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-background/40 p-3 text-sm text-muted-foreground">
                Nothing here yet. Drop a note for{" "}
                {isCustomer
                  ? message.authorName.split(" ")[0]
                  : ticket.assignee.name.split(" ")[0]}
                ?
              </div>
            ) : (
              <ul className="space-y-2.5">
                {comments.map((c) => (
                  <CommentRow key={c.id} comment={c} />
                ))}
              </ul>
            )}
            <CommentComposer
              value={pendingComment}
              onChange={onPendingCommentChange}
              onSubmit={onSubmitComment}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
      {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
    </div>
  );
}

function CitationRow({
  citation,
  agentCategory,
  customerCategory,
  isChangingScore,
  onStartChangeScore,
  onPickScore,
  onRemove,
}: {
  citation: Citation;
  agentCategory: SampleCategory | null;
  customerCategory: CustomerCategoryDef | null;
  isChangingScore: boolean;
  onStartChangeScore: () => void;
  onPickScore: (score: number) => void;
  onRemove: () => void;
}) {
  const hue = CATEGORY_HUE[citation.categoryId];
  const styles = HUE[hue];
  const isBinary = agentCategory?.scaleType === "binary";
  const isLikert = agentCategory?.scaleType === "likert_5";
  const name = agentCategory?.name ?? customerCategory?.name ?? "";
  const effectiveScore =
    isLikert && agentCategory
      ? (citation.score ?? agentCategory.effectiveScore)
      : null;

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 transition-colors",
        citation.isCustomer
          ? cn("border-dashed bg-background", styles.borderMid)
          : cn(styles.borderSoft, styles.bgSoft),
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            citation.isCustomer
              ? cn("size-2 shrink-0 rounded-full border", styles.border)
              : cn("size-2 shrink-0 rounded-full", styles.bg),
          )}
          aria-hidden
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-base font-medium",
            styles.textDark,
          )}
        >
          {name}
        </span>
        {citation.isCustomer ? (
          <span className="shrink-0 text-sm text-muted-foreground">
            signal
          </span>
        ) : (
          <span
            className={cn("shrink-0 text-sm tabular-nums", styles.textDark)}
          >
            {isBinary
              ? agentCategory!.effectiveScore === 1
                ? "Pass"
                : "Fail"
              : `${effectiveScore}/5`}
          </span>
        )}
        {citation.aiSuggested && (
          <Sparkles
            className={cn("size-3 shrink-0 opacity-80", styles.text)}
            aria-label="AI suggested"
          />
        )}
        {isLikert && (
          <button
            type="button"
            onClick={onStartChangeScore}
            className={cn(
              "shrink-0 cursor-pointer rounded-md px-1.5 py-0.5 text-sm transition-colors",
              styles.textDark,
              "hover:bg-background/70",
            )}
          >
            Change
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          className={cn(
            "shrink-0 cursor-pointer rounded-md p-1 transition-colors",
            styles.textDark,
            "hover:bg-background/70",
          )}
          aria-label={`Remove ${name}`}
        >
          <X className="size-3.5" />
        </button>
      </div>
      {isChangingScore && isLikert && (
        <div className="mt-2 flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-150">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onPickScore(n)}
              className={cn(
                "size-7 cursor-pointer rounded-md border text-sm font-medium tabular-nums transition-all",
                n === effectiveScore
                  ? cn(styles.bg, "border-transparent text-white shadow-sm")
                  : cn(
                      "border-border bg-background hover:scale-105",
                      styles.textDark,
                    ),
              )}
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AddPicker({
  isCustomer,
  availableAgent,
  availableCustomer,
  onPick,
  onCancel,
}: {
  isCustomer: boolean;
  availableAgent: SampleCategory[];
  availableCustomer: CustomerCategoryDef[];
  onPick: (catId: string, isCust: boolean) => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-background/40 p-2 animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="text-sm text-muted-foreground">
          {isCustomer ? "Pick a customer signal" : "Pick a category"}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>
      <ul className="space-y-1">
        {isCustomer
          ? availableCustomer.map((cat) => {
              const hue = CATEGORY_HUE[cat.id];
              const styles = HUE[hue];
              return (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => onPick(cat.id, true)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors",
                      "hover:bg-accent/50",
                    )}
                  >
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full border",
                        styles.border,
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-base text-foreground">
                      {cat.name}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      signal
                    </span>
                  </button>
                </li>
              );
            })
          : availableAgent.map((cat) => {
              const hue = CATEGORY_HUE[cat.id];
              const styles = HUE[hue];
              return (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => onPick(cat.id, false)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors",
                      "hover:bg-accent/50",
                    )}
                  >
                    <span
                      className={cn("size-2 shrink-0 rounded-full", styles.bg)}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-base text-foreground">
                      {cat.name}
                    </span>
                    <ScoreBadge category={cat} hue={hue} />
                  </button>
                </li>
              );
            })}
      </ul>
    </div>
  );
}

/* -------------------- Reactions hub -------------------- */

function ReactionsHub({
  reactions,
  onPick,
}: {
  reactions: Reaction[];
  onPick: (emoji: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 rounded-lg border border-dashed border-border bg-background/40 px-2 py-1.5">
        <Smile className="size-3.5 text-muted-foreground" />
        <span className="mr-1 text-sm text-muted-foreground">React:</span>
        {QUICK_REACTIONS.map((emoji) => {
          const mine = reactions.some(
            (r) => r.emoji === emoji && r.isMine,
          );
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => onPick(emoji)}
              className={cn(
                "flex size-7 cursor-pointer items-center justify-center rounded-md text-base transition-all hover:scale-110 hover:bg-accent",
                mine && "bg-accent",
              )}
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </button>
          );
        })}
      </div>
      {reactions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-background/40 p-3 text-sm text-muted-foreground">
          Be the first to react.
        </div>
      ) : (
        <ul className="space-y-1">
          {reactions.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-1.5 text-sm"
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  r.avatarColor,
                )}
                aria-hidden
              >
                {r.reactorInitials}
              </span>
              <span className="flex-1 text-foreground">{r.reactorName}</span>
              <span className="text-base">{r.emoji}</span>
              {r.isMine && (
                <button
                  type="button"
                  onClick={() => onPick(r.emoji)}
                  className="cursor-pointer rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Remove your reaction"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* -------------------- Comments -------------------- */

function CommentRow({ comment }: { comment: Comment }) {
  return (
    <li className="flex gap-2.5">
      <div
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground"
        aria-hidden
      >
        {comment.initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 text-sm">
          <span className="font-medium text-foreground">{comment.author}</span>
          <span className="text-muted-foreground">
            {formatRelative(comment.createdAt)}
          </span>
        </div>
        <p className="text-base text-foreground">{comment.body}</p>
      </div>
    </li>
  );
}

function CommentComposer({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (s: string) => void;
  onSubmit: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  return (
    <div className="mt-2.5">
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Add a coaching note…"
        className="min-h-16 resize-none text-base"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
      />
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          <kbd className="rounded border border-border bg-background px-1 font-mono text-xs">
            ⌘
          </kbd>{" "}
          +{" "}
          <kbd className="rounded border border-border bg-background px-1 font-mono text-xs">
            Enter
          </kbd>{" "}
          to post
        </span>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!value.trim()}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          <MessageSquarePlus className="size-3.5" />
          Comment
        </button>
      </div>
    </div>
  );
}

/* -------------------- Keyboard hint bar -------------------- */

function KeyboardHintBar() {
  return (
    <div className="pointer-events-none fixed bottom-3 left-1/2 z-30 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-border bg-popover/90 px-3 py-1.5 text-sm text-muted-foreground shadow-md backdrop-blur">
        <HintKey k="↑↓" label="navigate" />
        <span className="opacity-30">·</span>
        <HintKey k="⏎" label="inspect" />
        <span className="opacity-30">·</span>
        <HintKey k="esc" label="exit" />
        <span className="opacity-30">·</span>
        <HintKey k="⌘⏎" label="post comment" />
      </div>
    </div>
  );
}

function HintKey({ k, label }: { k: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <kbd className="rounded border border-border bg-background px-1 font-mono text-xs text-foreground">
        {k}
      </kbd>
      <span>{label}</span>
    </span>
  );
}
