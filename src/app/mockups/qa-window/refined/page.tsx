"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CircleDot,
  MessageSquarePlus,
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
import { Kbd } from "@/components/ui/kbd";
import {
  sampleTicket,
  type SampleCategory,
  type SampleMessage,
} from "@/lib/mockups/sample-data";
import { cn } from "@/lib/utils";

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

const REACTIONS = ["❤️", "🔥", "👍", "👀", "✨"] as const;
type Reaction = (typeof REACTIONS)[number];

type Citation = {
  key: string;
  messageId: string;
  categoryId: string;
  score: number | null;
  aiSuggested: boolean;
};

type Comment = {
  id: string;
  author: string;
  initials: string;
  body: string;
  createdAt: string;
};

type ActivityEvent = {
  id: string;
  afterMessageId: string;
  label: string;
};

const INITIAL_CITATIONS: Citation[] = (() => {
  const out: Citation[] = [];
  for (const cat of sampleTicket.evaluation.categories) {
    for (const msgId of cat.highlightedMessageIds) {
      out.push({
        key: `${msgId}::${cat.id}`,
        messageId: msgId,
        categoryId: cat.id,
        score: null,
        aiSuggested: true,
      });
    }
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
      body: "Tighten \"within the hour\" → wall-clock time. Otherwise excellent close.",
      createdAt: "2026-05-21T09:22:00Z",
    },
  ],
};

const INITIAL_REACTIONS: Record<string, Partial<Record<Reaction, number>>> = {
  msg_3: { "🔥": 2 },
  msg_5: { "❤️": 1, "👍": 3 },
  msg_7: { "✨": 1 },
};

const ACTIVITIES: ActivityEvent[] = [
  { id: "act_1", afterMessageId: "msg_1", label: "Assigned to Marisol Tate (Front line)" },
  { id: "act_2", afterMessageId: "msg_2", label: "Marisol opened order BB-48721 in fulfillment console" },
  { id: "act_3", afterMessageId: "msg_5", label: "Recovery offer template applied: \"overnight reship\"" },
  { id: "act_4", afterMessageId: "msg_7", label: "Discount code BLOOM-PS-15 generated · 15% off" },
];

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

export default function RefinedMockupPage() {
  const ticket = sampleTicket;
  const { evaluation, messages } = ticket;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [mutedCategoryId, setMutedCategoryId] = useState<string | null>(null);
  const [activityOn, setActivityOn] = useState(false);
  const [citations, setCitations] = useState<Citation[]>(INITIAL_CITATIONS);
  const [commentsByMsg, setCommentsByMsg] =
    useState<Record<string, Comment[]>>(INITIAL_COMMENTS);
  const [reactionsByMsg, setReactionsByMsg] = useState<
    Record<string, Partial<Record<Reaction, number>>>
  >(INITIAL_REACTIONS);
  const [pendingComment, setPendingComment] = useState("");
  const [changingScoreFor, setChangingScoreFor] = useState<string | null>(null);
  /** message id where the reaction strip is open. */
  const [reactionStripFor, setReactionStripFor] = useState<string | null>(null);
  /** message id where the add-category popover is open. */
  const [categoryPickerFor, setCategoryPickerFor] = useState<string | null>(
    null,
  );
  /** one-click rate state: { msgId, catId } after picking a category for an
   *  agent message — the score picker opens immediately. */
  const [oneClickScoreFor, setOneClickScoreFor] = useState<{
    msgId: string;
    catId: string;
  } | null>(null);

  const messageRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

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

  const citedIdsForMutedCategory = useMemo(() => {
    if (!mutedCategoryId) return null;
    return new Set(
      citations
        .filter((c) => c.categoryId === mutedCategoryId)
        .map((c) => c.messageId),
    );
  }, [mutedCategoryId, citations]);

  const relatedActivity = useMemo(() => {
    if (!selectedId || !activityOn) return [];
    const idx = messages.findIndex((m) => m.id === selectedId);
    if (idx < 0) return [];
    const nearby = new Set<string>();
    for (
      let i = Math.max(0, idx - 1);
      i <= Math.min(messages.length - 1, idx);
      i++
    ) {
      nearby.add(messages[i].id);
    }
    return ACTIVITIES.filter((a) => nearby.has(a.afterMessageId));
  }, [selectedId, activityOn, messages]);

  const activityAfterMessage = useMemo(() => {
    const m = new Map<string, ActivityEvent[]>();
    for (const a of ACTIVITIES) {
      const arr = m.get(a.afterMessageId) ?? [];
      arr.push(a);
      m.set(a.afterMessageId, arr);
    }
    return m;
  }, []);

  const resetEphemerals = useCallback(() => {
    setChangingScoreFor(null);
    setReactionStripFor(null);
    setCategoryPickerFor(null);
    setOneClickScoreFor(null);
    setPendingComment("");
  }, []);

  const selectMessage = useCallback(
    (id: string) => {
      setSelectedId((prev) => {
        if (prev !== id) {
          setChangingScoreFor(null);
          setPendingComment("");
        }
        return id;
      });
      setFocusedId(id);
      setMutedCategoryId(null);
    },
    [],
  );

  const clearSelection = useCallback(() => {
    setSelectedId((prev) => {
      if (prev !== null) {
        setChangingScoreFor(null);
        setReactionStripFor(null);
        setCategoryPickerFor(null);
        setOneClickScoreFor(null);
        setPendingComment("");
      }
      return null;
    });
  }, []);

  function toggleMute(catId: string) {
    setMutedCategoryId((curr) => (curr === catId ? null : catId));
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
    setCitations((prev) => {
      const exists = prev.some(
        (c) => c.messageId === messageId && c.categoryId === categoryId,
      );
      if (exists) {
        return prev.map((c) =>
          c.messageId === messageId && c.categoryId === categoryId
            ? { ...c, score }
            : c,
        );
      }
      return [
        ...prev,
        {
          key: `${messageId}::${categoryId}`,
          messageId,
          categoryId,
          score,
          aiSuggested: false,
        },
      ];
    });
    setChangingScoreFor(null);
    setOneClickScoreFor(null);
  }

  function addCitationViaOneClick(messageId: string, categoryId: string) {
    const category = evaluation.categories.find((c) => c.id === categoryId);
    setCategoryPickerFor(null);
    if (!category) return;
    if (category.scaleType === "binary") {
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
            score: 1,
            aiSuggested: false,
          },
        ];
      });
      return;
    }
    setOneClickScoreFor({ msgId: messageId, catId: categoryId });
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

  function addReaction(messageId: string, emoji: Reaction) {
    setReactionsByMsg((prev) => {
      const curr = prev[messageId] ?? {};
      return {
        ...prev,
        [messageId]: { ...curr, [emoji]: (curr[emoji] ?? 0) + 1 },
      };
    });
    setReactionStripFor(null);
  }

  /* ---- Keyboard navigation ---- */

  // Build an ordered list of focusable message ids (activities skipped for
  // selection — they exist as anchors but aren't selectable in this variant).
  const focusableIds = useMemo(() => messages.map((m) => m.id), [messages]);

  const moveFocus = useCallback(
    (delta: 1 | -1) => {
      setFocusedId((curr) => {
        if (focusableIds.length === 0) return curr;
        if (!curr) {
          return delta > 0
            ? focusableIds[0]
            : focusableIds[focusableIds.length - 1];
        }
        const idx = focusableIds.indexOf(curr);
        if (idx < 0) return focusableIds[0];
        const next = Math.max(
          0,
          Math.min(focusableIds.length - 1, idx + delta),
        );
        return focusableIds[next];
      });
    },
    [focusableIds],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tgt = e.target;
      const inEditable =
        tgt instanceof HTMLElement &&
        (tgt.tagName === "INPUT" ||
          tgt.tagName === "TEXTAREA" ||
          tgt.isContentEditable);

      if (e.key === "Escape") {
        if (selectedId) {
          e.preventDefault();
          clearSelection();
        } else if (mutedCategoryId) {
          e.preventDefault();
          setMutedCategoryId(null);
        }
        return;
      }

      if (inEditable) return;

      if (e.key === "ArrowDown" || e.key === "j" || e.key === "J") {
        e.preventDefault();
        moveFocus(1);
      } else if (e.key === "ArrowUp" || e.key === "k" || e.key === "K") {
        e.preventDefault();
        moveFocus(-1);
      } else if (e.key === "Enter") {
        if (focusedId) {
          e.preventDefault();
          selectMessage(focusedId);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, focusedId, mutedCategoryId, moveFocus, selectMessage, clearSelection]);

  // Scroll focused message into view when it changes via keyboard.
  useEffect(() => {
    if (!focusedId) return;
    const el = messageRefs.current.get(focusedId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusedId]);

  // When a sidebar category is selected, auto-scroll the first cited message
  // to the top of the viewport.
  useEffect(() => {
    if (!mutedCategoryId) return;
    const firstCited = messages.find((m) =>
      citations.some(
        (c) => c.messageId === m.id && c.categoryId === mutedCategoryId,
      ),
    );
    if (!firstCited) return;
    const el = messageRefs.current.get(firstCited.id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [mutedCategoryId, citations, messages]);

  return (
    <div className="relative pb-20">
      <div className="pr-[400px] transition-[padding] duration-300">
        <TicketHeader ticket={ticket} />
        <ActivityToggle
          activityOn={activityOn}
          onToggle={() => setActivityOn((v) => !v)}
        />

        {/* Click background → clear selection. Bubbles stopPropagation. */}
        <div
          className="mt-4 space-y-3"
          onClick={() => {
            if (selectedId) clearSelection();
            else if (mutedCategoryId) setMutedCategoryId(null);
            resetEphemerals();
          }}
        >
          {messages.map((msg) => {
            const cits = citationsByMessage.get(msg.id) ?? [];
            const isSelected = selectedId === msg.id;
            const isFocused = focusedId === msg.id && !isSelected;
            // Mute when a category in sidebar is selected and this message
            // isn't cited; or when a different message is selected.
            const isDimmed =
              (citedIdsForMutedCategory !== null &&
                !citedIdsForMutedCategory.has(msg.id)) ||
              (selectedId !== null && !isSelected);
            const showCategoryOutline =
              citedIdsForMutedCategory !== null &&
              citedIdsForMutedCategory.has(msg.id);
            const outlineHue: Hue | null = showCategoryOutline
              ? CATEGORY_HUE[mutedCategoryId!]
              : null;
            const activities = activityOn
              ? (activityAfterMessage.get(msg.id) ?? [])
              : [];
            return (
              <div key={msg.id}>
                <MessageBubble
                  ref={(el) => {
                    messageRefs.current.set(msg.id, el);
                  }}
                  message={msg}
                  citations={cits}
                  isSelected={isSelected}
                  isFocused={isFocused}
                  isDimmed={isDimmed}
                  outlineHue={outlineHue}
                  commentCount={(commentsByMsg[msg.id] ?? []).length}
                  reactions={reactionsByMsg[msg.id] ?? {}}
                  reactionStripOpen={reactionStripFor === msg.id}
                  categoryPickerOpen={categoryPickerFor === msg.id}
                  oneClickScoreFor={
                    oneClickScoreFor?.msgId === msg.id
                      ? oneClickScoreFor
                      : null
                  }
                  categories={evaluation.categories}
                  onSelect={() => selectMessage(msg.id)}
                  onAddComment={() => {
                    selectMessage(msg.id);
                    // focus composer after the panel renders
                    requestAnimationFrame(() => composerRef.current?.focus());
                  }}
                  onSetReactionsOpen={(open) => {
                    setReactionStripFor(open ? msg.id : null);
                    if (open) setCategoryPickerFor(null);
                  }}
                  onAddReaction={(emoji) => addReaction(msg.id, emoji)}
                  onSetCategoryOpen={(open) => {
                    setCategoryPickerFor(open ? msg.id : null);
                    if (open) setReactionStripFor(null);
                    if (!open) setOneClickScoreFor(null);
                  }}
                  onPickCategory={(catId) =>
                    addCitationViaOneClick(msg.id, catId)
                  }
                  onSetOneClickScore={(score) => {
                    if (!oneClickScoreFor) return;
                    setCitationScore(
                      oneClickScoreFor.msgId,
                      oneClickScoreFor.catId,
                      score,
                    );
                  }}
                  onCancelOneClick={() => setOneClickScoreFor(null)}
                />
                {activities.map((a) => (
                  <ActivityRow
                    key={a.id}
                    event={a}
                    dimmed={
                      (citedIdsForMutedCategory !== null) ||
                      selectedId !== null
                    }
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <aside
        className="absolute right-0 top-0 z-20 w-[380px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-4">
          {selected ? (
            <InspectPanel
              ticket={ticket}
              message={selected}
              citations={citationsByMessage.get(selected.id) ?? []}
              comments={commentsByMsg[selected.id] ?? []}
              relatedActivity={relatedActivity}
              activityOn={activityOn}
              changingScoreFor={changingScoreFor}
              pendingComment={pendingComment}
              composerRef={composerRef}
              onClose={clearSelection}
              onRemoveCitation={removeCitation}
              onSetScore={setCitationScore}
              onStartChangingScore={(catId) =>
                setChangingScoreFor((curr) => (curr === catId ? null : catId))
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

/* -------------------- Ticket header + activity toggle -------------------- */

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
          Click any message to inspect it. Use ↑↓ or J/K to navigate, ⏎ to
          inspect, Esc to exit.
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

type MessageBubbleProps = {
  message: SampleMessage;
  citations: Citation[];
  isSelected: boolean;
  isFocused: boolean;
  isDimmed: boolean;
  outlineHue: Hue | null;
  commentCount: number;
  reactions: Partial<Record<Reaction, number>>;
  reactionStripOpen: boolean;
  categoryPickerOpen: boolean;
  oneClickScoreFor: { msgId: string; catId: string } | null;
  categories: SampleCategory[];
  onSelect: () => void;
  onAddComment: () => void;
  onSetReactionsOpen: (open: boolean) => void;
  onAddReaction: (emoji: Reaction) => void;
  onSetCategoryOpen: (open: boolean) => void;
  onPickCategory: (catId: string) => void;
  onSetOneClickScore: (score: number) => void;
  onCancelOneClick: () => void;
};

function MessageBubble({
  ref,
  message,
  citations,
  isSelected,
  isFocused,
  isDimmed,
  outlineHue,
  commentCount,
  reactions,
  reactionStripOpen,
  categoryPickerOpen,
  oneClickScoreFor,
  categories,
  onSelect,
  onAddComment,
  onSetReactionsOpen,
  onAddReaction,
  onSetCategoryOpen,
  onPickCategory,
  onSetOneClickScore,
  onCancelOneClick,
}: MessageBubbleProps & { ref?: (el: HTMLDivElement | null) => void }) {
  const isAgent = message.role === "agent";
  const outlineStyles = outlineHue ? HUE[outlineHue] : null;
  const reactionEntries = (Object.entries(reactions) as [Reaction, number][])
    .filter(([, n]) => n > 0);
  const hasCitedCategories = new Set(citations.map((c) => c.categoryId));
  const availableCategories = categories.filter(
    (c) => !hasCitedCategories.has(c.id),
  );
  const oneClickCategory = oneClickScoreFor
    ? categories.find((c) => c.id === oneClickScoreFor.catId)
    : null;

  return (
    <div
      ref={ref}
      className={cn(
        "scroll-mt-4 flex gap-3 transition-all duration-300 ease-out",
        isAgent ? "flex-row-reverse" : "flex-row",
        isDimmed && "opacity-30 blur-[0.5px]",
      )}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
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

        <div
          className={cn(
            "relative inline-block max-w-full",
            isAgent ? "self-end" : "self-start",
          )}
        >
          {/* Selected-message floating action toolbar */}
          {isSelected && (
            <SelectedToolbar
              isAgent={isAgent}
              isCustomer={message.role === "customer"}
              onAddComment={(e) => {
                e.stopPropagation();
                onAddComment();
              }}
              onSetReactionsOpen={onSetReactionsOpen}
              onSetCategoryOpen={onSetCategoryOpen}
              reactionStripOpen={reactionStripOpen}
              categoryPickerOpen={categoryPickerOpen}
              availableCategories={availableCategories}
              onPickCategory={onPickCategory}
              onAddReaction={onAddReaction}
              oneClickScoreFor={oneClickScoreFor}
              oneClickCategory={oneClickCategory}
              onSetOneClickScore={onSetOneClickScore}
              onCancelOneClick={onCancelOneClick}
            />
          )}

          <button
            type="button"
            className={cn(
              "relative inline-block max-w-full cursor-pointer rounded-2xl border px-4 py-3 text-left text-base transition-all duration-200 ease-out",
              isAgent
                ? "rounded-tr-sm border-primary/20 bg-primary/10 text-foreground"
                : "rounded-tl-sm border-border bg-card text-foreground",
              "hover:-translate-y-px hover:shadow-md",
              isSelected &&
                "ring-2 ring-primary/40 ring-offset-1 ring-offset-background shadow-md -translate-y-px",
              isFocused &&
                "ring-2 ring-ring ring-offset-1 ring-offset-background",
              outlineStyles && cn("ring-2", outlineStyles.ring),
            )}
          >
            {message.body}
          </button>
        </div>

        {(citations.length > 0 ||
          commentCount > 0 ||
          reactionEntries.length > 0) && (
          <div
            className={cn(
              "flex flex-wrap items-center gap-1.5 pt-1",
              isAgent ? "justify-end" : "justify-start",
            )}
          >
            {citations.map((c) => (
              <CategoryTab key={c.key} citation={c} />
            ))}
            {commentCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-sm text-muted-foreground">
                <span aria-hidden>💬</span>
                <span className="tabular-nums">{commentCount}</span>
              </span>
            )}
            {reactionEntries.map(([emoji, count]) => (
              <span
                key={emoji}
                className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-sm text-muted-foreground"
              >
                <span aria-hidden>{emoji}</span>
                <span className="tabular-nums">{count}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------- Floating action toolbar (selected bubble) -------------------- */

function SelectedToolbar({
  isAgent,
  isCustomer,
  onAddComment,
  onSetReactionsOpen,
  onSetCategoryOpen,
  reactionStripOpen,
  categoryPickerOpen,
  availableCategories,
  onPickCategory,
  onAddReaction,
  oneClickScoreFor,
  oneClickCategory,
  onSetOneClickScore,
  onCancelOneClick,
}: {
  isAgent: boolean;
  isCustomer: boolean;
  onAddComment: (e: React.MouseEvent) => void;
  onSetReactionsOpen: (open: boolean) => void;
  onSetCategoryOpen: (open: boolean) => void;
  reactionStripOpen: boolean;
  categoryPickerOpen: boolean;
  availableCategories: SampleCategory[];
  onPickCategory: (catId: string) => void;
  onAddReaction: (emoji: Reaction) => void;
  oneClickScoreFor: { msgId: string; catId: string } | null;
  oneClickCategory: SampleCategory | null | undefined;
  onSetOneClickScore: (score: number) => void;
  onCancelOneClick: () => void;
}) {
  return (
    <div
      className={cn(
        "absolute -top-10 z-20 flex items-center gap-0.5 rounded-lg border border-border bg-popover p-0.5 shadow-md animate-in fade-in slide-in-from-bottom-1 duration-150",
        isAgent ? "right-2" : "left-2",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <ToolbarBtn label="Add comment" onClick={onAddComment}>
        <MessageSquarePlus className="size-4" />
      </ToolbarBtn>

      {!isCustomer && (
        <Popover
          open={categoryPickerOpen}
          onOpenChange={(open) => {
            if (!open) onCancelOneClick();
            onSetCategoryOpen(open);
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Add to category"
              className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Tags className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align={isAgent ? "end" : "start"}
            className="w-64 p-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            {oneClickScoreFor && oneClickCategory ? (
              <OneClickScorePicker
                category={oneClickCategory}
                onSetScore={onSetOneClickScore}
                onCancel={onCancelOneClick}
              />
            ) : (
              <>
                <div className="px-2 pb-1.5 pt-1 text-sm font-medium text-muted-foreground">
                  Add to category
                </div>
                <ul className="flex flex-col gap-0.5">
                  {availableCategories.length === 0 && (
                    <li className="px-2 py-1.5 text-sm text-muted-foreground">
                      Already cited under every category.
                    </li>
                  )}
                  {availableCategories.map((cat) => {
                    const hue = HUE[CATEGORY_HUE[cat.id]];
                    return (
                      <li key={cat.id}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPickCategory(cat.id);
                          }}
                          className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-base transition-colors hover:bg-accent"
                        >
                          <span
                            className={cn("size-2 rounded-full", hue.bg)}
                            aria-hidden
                          />
                          <span className="flex-1 text-foreground">
                            {cat.name}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </PopoverContent>
        </Popover>
      )}

      <Popover
        open={reactionStripOpen}
        onOpenChange={onSetReactionsOpen}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Add reaction"
            className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Smile className="size-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align={isAgent ? "end" : "start"}
          className="w-auto p-1"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-0.5">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddReaction(emoji);
                }}
                aria-label={`React with ${emoji}`}
                className="flex size-8 cursor-pointer items-center justify-center rounded-md text-lg transition-all hover:scale-110 hover:bg-accent"
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ToolbarBtn({
  onClick,
  label,
  children,
}: {
  onClick: (e: React.MouseEvent) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}

function OneClickScorePicker({
  category,
  onSetScore,
  onCancel,
}: {
  category: SampleCategory;
  onSetScore: (score: number) => void;
  onCancel: () => void;
}) {
  const hue = HUE[CATEGORY_HUE[category.id]];
  return (
    <div className="space-y-2 p-1 animate-in fade-in duration-150">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <span className={cn("size-2 rounded-full", hue.bg)} aria-hidden />
          <span>Score for {category.name}</span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSetScore(n);
            }}
            aria-label={`Score ${n}`}
            className="cursor-pointer rounded-md p-1.5 transition-all hover:scale-110 hover:bg-accent"
          >
            <Star className={cn("size-5", hue.text)} />
          </button>
        ))}
      </div>
      <div className="px-1 text-sm text-muted-foreground">
        One click — picks the category and the score in the same move.
      </div>
    </div>
  );
}

/* -------------------- Citation pill (under bubble) -------------------- */

function CategoryTab({ citation }: { citation: Citation }) {
  const hue = CATEGORY_HUE[citation.categoryId];
  const styles = HUE[hue];
  const category = sampleTicket.evaluation.categories.find(
    (c) => c.id === citation.categoryId,
  );
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm font-medium shadow-sm",
        styles.bgSoft,
        styles.borderSoft,
        styles.textDark,
      )}
    >
      <span className={cn("size-1.5 rounded-full", styles.bg)} aria-hidden />
      <span>{category?.name ?? citation.categoryId}</span>
      {citation.aiSuggested && (
        <Sparkles className="size-3 opacity-80" aria-label="AI suggested" />
      )}
    </span>
  );
}

/* -------------------- Overview panel (no message selected) -------------------- */

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

/* -------------------- Inspect panel (message selected) -------------------- */

function InspectPanel({
  ticket,
  message,
  citations,
  comments,
  relatedActivity,
  activityOn,
  changingScoreFor,
  pendingComment,
  composerRef,
  onClose,
  onRemoveCitation,
  onSetScore,
  onStartChangingScore,
  onPendingCommentChange,
  onSubmitComment,
}: {
  ticket: typeof sampleTicket;
  message: SampleMessage;
  citations: Citation[];
  comments: Comment[];
  relatedActivity: ActivityEvent[];
  activityOn: boolean;
  changingScoreFor: string | null;
  pendingComment: string;
  composerRef: React.RefObject<HTMLTextAreaElement | null>;
  onClose: () => void;
  onRemoveCitation: (messageId: string, categoryId: string) => void;
  onSetScore: (messageId: string, categoryId: string, score: number) => void;
  onStartChangingScore: (categoryId: string) => void;
  onPendingCommentChange: (s: string) => void;
  onSubmitComment: () => void;
}) {
  const { evaluation } = ticket;
  const isCustomer = message.role === "customer";
  const firstName = ticket.assignee.name.split(" ")[0];

  return (
    <div
      className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-card/95 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-right-2 duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Back-arrow-only header */}
      <div className="flex items-center gap-2 border-b border-border bg-background/40 px-2 py-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to overview"
          className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          <span>Back</span>
        </button>
        <span className="text-sm text-muted-foreground">
          Inspecting {message.authorName.split(" ")[0]}&apos;s {message.role}{" "}
          message
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-5 p-4">
          {/* Citations (agent only) */}
          {isCustomer ? (
            <section>
              <SectionHeader label="Categorization" />
              <div className="rounded-lg border border-dashed border-border bg-background/40 p-3 text-sm text-muted-foreground">
                Customer messages aren&apos;t scored — they&apos;re what the
                agent is responding to. React or comment instead.
              </div>
            </section>
          ) : (
            <section>
              <SectionHeader
                label="Citations"
                hint={
                  citations.length === 0
                    ? "Not cited under any category yet."
                    : `${citations.length} ${citations.length === 1 ? "citation" : "citations"}`
                }
              />
              <div className="space-y-1.5">
                {citations.map((c) => {
                  const cat = evaluation.categories.find(
                    (x) => x.id === c.categoryId,
                  );
                  if (!cat) return null;
                  const effectiveScore = c.score ?? cat.effectiveScore;
                  return (
                    <CitationRow
                      key={c.key}
                      citation={c}
                      category={cat}
                      effectiveScore={effectiveScore}
                      isChangingScore={changingScoreFor === c.categoryId}
                      onStartChangingScore={() =>
                        onStartChangingScore(c.categoryId)
                      }
                      onSetScore={(s) =>
                        onSetScore(message.id, c.categoryId, s)
                      }
                      onRemove={() =>
                        onRemoveCitation(message.id, c.categoryId)
                      }
                    />
                  );
                })}
                {citations.length === 0 && (
                  <p className="px-1 text-sm text-muted-foreground">
                    Use the toolbar above the bubble to attach a category.
                  </p>
                )}
              </div>
            </section>
          )}

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
                {isCustomer
                  ? "No notes yet on this message — drop one to flag a moment."
                  : `Nothing here yet. Drop a note for ${firstName}?`}
              </div>
            ) : (
              <ul className="space-y-2.5">
                {comments.map((c) => (
                  <CommentRow key={c.id} comment={c} />
                ))}
              </ul>
            )}
            <CommentComposer
              ref={composerRef}
              value={pendingComment}
              onChange={onPendingCommentChange}
              onSubmit={onSubmitComment}
            />
          </section>

          {/* Related activity */}
          {activityOn && relatedActivity.length > 0 && (
            <section>
              <SectionHeader label="Related activity" />
              <ul className="space-y-1.5">
                {relatedActivity.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-start gap-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-sm text-muted-foreground"
                  >
                    <CircleDot className="mt-0.5 size-3 shrink-0" />
                    <span>{a.label}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
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
  category,
  effectiveScore,
  isChangingScore,
  onStartChangingScore,
  onSetScore,
  onRemove,
}: {
  citation: Citation;
  category: SampleCategory;
  effectiveScore: number;
  isChangingScore: boolean;
  onStartChangingScore: () => void;
  onSetScore: (s: number) => void;
  onRemove: () => void;
}) {
  const hue = CATEGORY_HUE[category.id];
  const styles = HUE[hue];
  const isBinary = category.scaleType === "binary";

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 transition-colors",
        styles.borderSoft,
        styles.bgSoft,
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn("size-2 shrink-0 rounded-full", styles.bg)}
          aria-hidden
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-base font-medium",
            styles.textDark,
          )}
        >
          {category.name}
        </span>
        <span
          className={cn("shrink-0 text-sm tabular-nums", styles.textDark)}
        >
          {isBinary
            ? effectiveScore === 1
              ? "Pass"
              : "Fail"
            : `${effectiveScore}/5`}
        </span>
        {citation.aiSuggested && (
          <Sparkles
            className={cn("size-3 shrink-0 opacity-80", styles.text)}
            aria-label="AI suggested"
          />
        )}
        {!isBinary && (
          <button
            type="button"
            onClick={onStartChangingScore}
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
          aria-label={`Remove ${category.name} citation`}
        >
          <X className="size-3.5" />
        </button>
      </div>
      {isChangingScore && !isBinary && (
        <div className="mt-2 flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-150">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onSetScore(n)}
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
  ref,
  value,
  onChange,
  onSubmit,
}: {
  ref: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (s: string) => void;
  onSubmit: () => void;
}) {
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
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <Kbd>⌘</Kbd>
          <span>+</span>
          <Kbd>⏎</Kbd>
          <span>to post</span>
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
    <div
      className="fixed bottom-3 left-1/2 z-30 flex h-9 -translate-x-1/2 items-center gap-3 rounded-full bg-foreground/90 px-4 text-sm text-background shadow-lg backdrop-blur"
      onClick={(e) => e.stopPropagation()}
    >
      <HintItem keys={["↑", "↓"]} label="navigate" />
      <span className="opacity-40" aria-hidden>
        ·
      </span>
      <HintItem keys={["⏎"]} label="inspect" />
      <span className="opacity-40" aria-hidden>
        ·
      </span>
      <HintItem keys={["Esc"]} label="exit" />
      <span className="opacity-40" aria-hidden>
        ·
      </span>
      <HintItem keys={["⌘", "⏎"]} label="post" />
    </div>
  );
}

function HintItem({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="flex items-center gap-0.5">
        {keys.map((k, i) => (
          <kbd
            key={i}
            className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-background/30 bg-background/15 px-1 font-sans text-xs font-medium text-background"
          >
            {k}
          </kbd>
        ))}
      </span>
      <span className="opacity-80">{label}</span>
    </span>
  );
}
