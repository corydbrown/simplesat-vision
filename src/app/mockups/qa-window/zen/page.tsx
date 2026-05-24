"use client";

/**
 * Zen — Round 6 exploratory ideas on EXISTING features.
 *
 * Same feature set as the round-6 base. Four visual experiments layered on:
 *   1. Citation flag-ribbons (sticky-tab metaphor) instead of pill chips
 *   2. AI reasoning as inline marginalia (book-annotation aesthetic)
 *   3. Spotlight category filter (selected glows + soft-pulse, others mute)
 *   4. Ribbon-style contextual popup (labeled actions, slide-down strip)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CircleDot,
  Keyboard,
  Plus,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  sampleTicket,
  type SampleCategory,
  type SampleMessage,
} from "@/lib/mockups/sample-data";
import { cn } from "@/lib/utils";

/* -------------------- Constants -------------------- */

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
    /** CSS color for inline-style glow effects. Maps to the same shade as `bg`. */
    glow: string;
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
    glow: "var(--color-blue)",
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
    glow: "var(--color-green)",
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
    glow: "var(--color-yellow)",
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
    glow: "var(--color-purple)",
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
    glow: "var(--color-teal)",
  },
};

const REACTIONS = ["👀", "👍", "❤️", "🔥", "✨", "😬"] as const;
type Reaction = (typeof REACTIONS)[number];

/* -------------------- Types -------------------- */

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

type ReactionState = Record<string, string[]>;

/* -------------------- Initial state -------------------- */

const INITIAL_CITATIONS: Citation[] = (() => {
  const out: Citation[] = [];
  for (const cat of sampleTicket.evaluation.categories) {
    for (const msgId of cat.highlightedMessageIds) {
      out.push({
        key: `${msgId}::${cat.id}`,
        messageId: msgId,
        categoryId: cat.id,
        score: cat.aiScore,
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
      body: "Two real options, tied to her deadline. Reference this as the template for Message 5 in the next workshop.",
      createdAt: "2026-05-21T09:18:00Z",
    },
  ],
  msg_7: [
    {
      id: "c4",
      author: "Diego Park",
      initials: "DP",
      body: "Tighten \"within the hour\" → wall-clock time on the close (Message 7). Otherwise excellent.",
      createdAt: "2026-05-21T09:22:00Z",
    },
  ],
};

const INITIAL_REACTIONS: Record<string, ReactionState> = {
  msg_3: { "🔥": ["Ana Rivera", "Diego Park"], "✨": ["Sam Okafor"] },
  msg_5: { "❤️": ["Ana Rivera"], "👍": ["Diego Park", "Sam Okafor", "Maya Lin"] },
  msg_7: { "✨": ["Ana Rivera"] },
};

const INITIAL_COMMENT_REACTIONS: Record<string, ReactionState> = {
  c1: { "👍": ["Diego Park", "Sam Okafor"] },
  c3: { "❤️": ["Diego Park"], "🔥": ["Maya Lin"] },
};

const ACTIVITIES: ActivityEvent[] = [
  { id: "act_1", afterMessageId: "msg_1", label: "Assigned to Marisol Tate (Front line)" },
  { id: "act_2", afterMessageId: "msg_2", label: "Marisol opened order BB-48721 in fulfillment console" },
  { id: "act_3", afterMessageId: "msg_5", label: "Recovery offer template applied: \"overnight reship\"" },
  { id: "act_4", afterMessageId: "msg_7", label: "Discount code BLOOM-PS-15 generated · 15% off" },
];

/* -------------------- Time helpers -------------------- */

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelative(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* -------------------- Picker state machine -------------------- */

type PickerMode =
  | { kind: "none" }
  | { kind: "category"; messageId: string }
  | { kind: "score"; messageId: string; categoryId: string }
  | { kind: "reaction"; messageId: string };

/* -------------------- Zen-specific local CSS -------------------- */

const ZEN_STYLES = `
@keyframes zen-glow-pulse {
  0%   { box-shadow: 0 0 0 0 transparent, 0 0 0 0 transparent; }
  35%  { box-shadow: 0 0 0 4px var(--zen-glow-soft), 0 0 22px 6px var(--zen-glow-mid); }
  100% { box-shadow: 0 0 0 2px var(--zen-glow-soft), 0 0 10px 2px var(--zen-glow-mid); }
}
.zen-glow {
  animation: zen-glow-pulse 1.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes zen-ribbon-unroll {
  0%   { opacity: 0; transform: translate(-50%, -6px) scaleY(0.6); }
  100% { opacity: 1; transform: translate(-50%, 0) scaleY(1); }
}
.zen-ribbon-pop {
  animation: zen-ribbon-unroll 160ms ease-out forwards;
  transform-origin: top center;
}
@keyframes zen-marginalia-in {
  0%   { opacity: 0; transform: translateY(2px); }
  100% { opacity: 0.95; transform: translateY(0); }
}
.zen-marginalia {
  animation: zen-marginalia-in 200ms ease-out forwards;
}
`;

/* -------------------- Page -------------------- */

export default function ZenMockupPage() {
  const ticket = sampleTicket;
  const { evaluation, messages } = ticket;

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [mutedCategoryId, setMutedCategoryId] = useState<string | null>(null);
  const [hoveredCategoryId, setHoveredCategoryId] = useState<string | null>(null);
  const [hoveredCitationKey, setHoveredCitationKey] = useState<string | null>(
    null,
  );
  const [activityOn, setActivityOn] = useState(false);
  const [citations, setCitations] = useState<Citation[]>(INITIAL_CITATIONS);
  const [commentsByMsg, setCommentsByMsg] =
    useState<Record<string, Comment[]>>(INITIAL_COMMENTS);
  const [reactionsByMsg, setReactionsByMsg] =
    useState<Record<string, ReactionState>>(INITIAL_REACTIONS);
  const [commentReactionsById, setCommentReactionsById] = useState<
    Record<string, ReactionState>
  >(INITIAL_COMMENT_REACTIONS);
  const [pendingComment, setPendingComment] = useState("");
  const [picker, setPicker] = useState<PickerMode>({ kind: "none" });
  const [composerFocused, setComposerFocused] = useState(false);
  const [cheatOpen, setCheatOpen] = useState(false);
  /** Bumps each time mutedCategoryId is selected (not cleared), so the
   *  spotlight pulse animation re-triggers on every selection. */
  const [spotlightTick, setSpotlightTick] = useState(0);

  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const inspectMessage = inspectId
    ? messages.find((m) => m.id === inspectId) ?? null
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

  const mutedCitedIds = useMemo(() => {
    if (!mutedCategoryId) return null;
    return new Set(
      citations
        .filter((c) => c.categoryId === mutedCategoryId)
        .map((c) => c.messageId),
    );
  }, [mutedCategoryId, citations]);

  /** The category whose AI-reasoning marginalia should currently fade in.
   *  Hover beats selection (so peeking a different card doesn't have to
   *  unselect first). */
  const activeMarginaliaCategoryId =
    hoveredCategoryId ?? mutedCategoryId ?? null;

  const activityAfterMessage = useMemo(() => {
    const m = new Map<string, ActivityEvent[]>();
    for (const a of ACTIVITIES) {
      const arr = m.get(a.afterMessageId) ?? [];
      arr.push(a);
      m.set(a.afterMessageId, arr);
    }
    return m;
  }, []);

  const messageIndex = useMemo(() => {
    const m = new Map<string, number>();
    messages.forEach((msg, i) => m.set(msg.id, i + 1));
    return m;
  }, [messages]);

  /* ---- Mutators ---- */

  const closeAllOverlays = useCallback(() => {
    setPicker({ kind: "none" });
  }, []);

  const openInspect = useCallback(
    (id: string) => {
      setInspectId(id);
      setFocusedId(id);
      setMutedCategoryId(null);
      closeAllOverlays();
      setPendingComment("");
      requestAnimationFrame(() => {
        composerRef.current?.focus();
      });
    },
    [closeAllOverlays],
  );

  const closeInspect = useCallback(() => {
    setInspectId(null);
    setPendingComment("");
    closeAllOverlays();
  }, [closeAllOverlays]);

  const toggleMutedCategory = useCallback((id: string) => {
    setMutedCategoryId((curr) => {
      if (curr === id) return null;
      setSpotlightTick((t) => t + 1);
      return id;
    });
  }, []);

  function addCitation(messageId: string, categoryId: string): SampleCategory | null {
    const category = evaluation.categories.find((c) => c.id === categoryId);
    if (!category) return null;
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
          score: category.scaleType === "binary" ? 1 : null,
          aiSuggested: false,
        },
      ];
    });
    return category;
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
  }

  function removeCitation(messageId: string, categoryId: string) {
    setCitations((prev) =>
      prev.filter(
        (c) => !(c.messageId === messageId && c.categoryId === categoryId),
      ),
    );
  }

  function submitComment() {
    if (!inspectId || !pendingComment.trim()) return;
    const next: Comment = {
      id: `c_${Date.now()}`,
      author: "You",
      initials: "YO",
      body: pendingComment.trim(),
      createdAt: new Date().toISOString(),
    };
    setCommentsByMsg((prev) => ({
      ...prev,
      [inspectId]: [...(prev[inspectId] ?? []), next],
    }));
    setPendingComment("");
  }

  function toggleReaction(messageId: string, emoji: Reaction) {
    setReactionsByMsg((prev) => {
      const curr = prev[messageId] ?? {};
      const list = curr[emoji] ?? [];
      const has = list.includes("You");
      const nextList = has
        ? list.filter((n) => n !== "You")
        : [...list, "You"];
      const nextMap = { ...curr };
      if (nextList.length === 0) {
        delete nextMap[emoji];
      } else {
        nextMap[emoji] = nextList;
      }
      return { ...prev, [messageId]: nextMap };
    });
  }

  function toggleCommentReaction(commentId: string, emoji: Reaction) {
    setCommentReactionsById((prev) => {
      const curr = prev[commentId] ?? {};
      const list = curr[emoji] ?? [];
      const has = list.includes("You");
      const nextList = has
        ? list.filter((n) => n !== "You")
        : [...list, "You"];
      const nextMap = { ...curr };
      if (nextList.length === 0) {
        delete nextMap[emoji];
      } else {
        nextMap[emoji] = nextList;
      }
      return { ...prev, [commentId]: nextMap };
    });
  }

  /* ---- Keyboard navigation ---- */

  const moveFocus = useCallback(
    (delta: 1 | -1) => {
      const ids = messages.map((m) => m.id);
      setFocusedId((curr) => {
        if (!curr) return delta > 0 ? ids[0] : ids[ids.length - 1];
        const idx = ids.indexOf(curr);
        if (idx < 0) return ids[0];
        const next = Math.max(0, Math.min(ids.length - 1, idx + delta));
        return ids[next];
      });
    },
    [messages],
  );

  useEffect(() => {
    function handler(e: globalThis.KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "TEXTAREA" || target?.tagName === "INPUT";

      if (e.key === "?" && !isTyping) {
        e.preventDefault();
        setCheatOpen((v) => !v);
        return;
      }
      if (cheatOpen) return;

      if (e.key === "Escape") {
        if (picker.kind !== "none") {
          e.preventDefault();
          setPicker({ kind: "none" });
          return;
        }
        if (isTyping) {
          e.preventDefault();
          composerRef.current?.blur();
          return;
        }
        if (inspectId) {
          e.preventDefault();
          closeInspect();
          return;
        }
        if (mutedCategoryId) {
          e.preventDefault();
          setMutedCategoryId(null);
          return;
        }
        return;
      }

      if (isTyping) return;

      if (picker.kind === "category") {
        const n = Number(e.key);
        if (
          Number.isInteger(n) &&
          n >= 1 &&
          n <= evaluation.categories.length
        ) {
          e.preventDefault();
          const cat = evaluation.categories[n - 1];
          const added = addCitation(picker.messageId, cat.id);
          if (!added) return;
          if (added.scaleType === "binary") {
            setPicker({ kind: "none" });
          } else {
            setPicker({
              kind: "score",
              messageId: picker.messageId,
              categoryId: cat.id,
            });
          }
          return;
        }
        return;
      }
      if (picker.kind === "score") {
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= 5) {
          e.preventDefault();
          setCitationScore(picker.messageId, picker.categoryId, n);
          setPicker({ kind: "none" });
          return;
        }
        return;
      }
      if (picker.kind === "reaction") {
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= REACTIONS.length) {
          e.preventDefault();
          toggleReaction(picker.messageId, REACTIONS[n - 1]);
          setPicker({ kind: "none" });
          return;
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
        case "j":
        case "J":
          e.preventDefault();
          moveFocus(1);
          return;
        case "ArrowUp":
        case "k":
        case "K":
          e.preventDefault();
          moveFocus(-1);
          return;
        case "Enter":
          if (focusedId) {
            e.preventDefault();
            openInspect(focusedId);
          }
          return;
      }

      if (!focusedId) return;
      const focused = messages.find((m) => m.id === focusedId);
      if (!focused) return;

      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        openInspect(focusedId);
        return;
      }
      if (e.key === "t" || e.key === "T") {
        if (focused.role !== "agent") return;
        e.preventDefault();
        setPicker({ kind: "category", messageId: focusedId });
        return;
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        setPicker({ kind: "reaction", messageId: focusedId });
        return;
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    picker,
    cheatOpen,
    inspectId,
    mutedCategoryId,
    focusedId,
    messages,
    evaluation.categories,
    moveFocus,
    openInspect,
    closeInspect,
  ]);

  useEffect(() => {
    if (!focusedId) return;
    const el = messageRefs.current.get(focusedId);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusedId]);

  useEffect(() => {
    if (!mutedCategoryId) return;
    const firstCited = messages.find((m) =>
      citations.some(
        (c) => c.messageId === m.id && c.categoryId === mutedCategoryId,
      ),
    );
    if (!firstCited) return;
    const el = messageRefs.current.get(firstCited.id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [mutedCategoryId, citations, messages]);

  /* ---- Footer hints ---- */

  const footerHints = useMemo<{ keys: string[]; label: string }[] | null>(() => {
    if (cheatOpen) return null;
    if (picker.kind === "category") {
      return [
        { keys: ["1", "…", "5"], label: "category" },
        { keys: ["Esc"], label: "cancel" },
      ];
    }
    if (picker.kind === "score") {
      return [
        { keys: ["1", "…", "5"], label: "score" },
        { keys: ["Esc"], label: "cancel" },
      ];
    }
    if (picker.kind === "reaction") {
      return [
        { keys: ["1", "…", "6"], label: "react" },
        { keys: ["Esc"], label: "cancel" },
      ];
    }
    if (composerFocused) {
      return [
        { keys: ["⌘", "↵"], label: "post" },
        { keys: ["Esc"], label: "blur" },
      ];
    }
    if (inspectId) {
      return [
        { keys: ["↑", "↓"], label: "nav" },
        { keys: ["Esc"], label: "exit inspect" },
        { keys: ["?"], label: "more" },
      ];
    }
    const focused = focusedId ? messages.find((m) => m.id === focusedId) : null;
    const base: { keys: string[]; label: string }[] = [
      { keys: ["↑", "↓"], label: "nav" },
      { keys: ["↵"], label: "inspect" },
      { keys: ["C"], label: "comment" },
    ];
    if (focused?.role === "agent") base.push({ keys: ["T"], label: "categorize" });
    base.push({ keys: ["R"], label: "react" });
    base.push({ keys: ["?"], label: "shortcuts" });
    return base;
  }, [cheatOpen, picker, composerFocused, inspectId, focusedId, messages]);

  return (
    <TooltipProvider delayDuration={200}>
      <style dangerouslySetInnerHTML={{ __html: ZEN_STYLES }} />
      <div className="relative pb-16">
        <div className="grid grid-cols-[1fr_380px] gap-6">
          <div className="min-w-0">
            <TicketHeader ticket={ticket} />
            <PromptBar
              activityOn={activityOn}
              onToggleActivity={() => setActivityOn((v) => !v)}
              onOpenCheat={() => setCheatOpen(true)}
            />

            <div className="mt-4 space-y-3">
              {messages.map((msg) => {
                const cits = citationsByMessage.get(msg.id) ?? [];
                const reactionMap = reactionsByMsg[msg.id] ?? {};
                const isFocused = focusedId === msg.id;
                const isInspected = inspectId === msg.id;
                const isCategoryCited =
                  mutedCitedIds !== null && mutedCitedIds.has(msg.id);
                const isDimmed =
                  (mutedCitedIds !== null && !isCategoryCited) ||
                  (inspectId !== null && !isInspected);
                const outlineHue: Hue | null = isCategoryCited
                  ? CATEGORY_HUE[mutedCategoryId!]
                  : null;
                const activities = activityOn
                  ? activityAfterMessage.get(msg.id) ?? []
                  : [];
                const popupOpen =
                  !inspectId &&
                  !composerFocused &&
                  picker.kind === "none" &&
                  (hoveredMessageId === msg.id || focusedId === msg.id);
                /** AI reasoning to show in the right gutter for THIS message,
                 *  based on whichever category is currently hovered/selected.
                 *  Only renders for agent messages cited under that category. */
                const marginaliaReasoning =
                  msg.role === "agent" && activeMarginaliaCategoryId
                    ? cits.find(
                        (c) => c.categoryId === activeMarginaliaCategoryId,
                      )
                      ? evaluation.categories.find(
                          (c) => c.id === activeMarginaliaCategoryId,
                        )?.aiReasoning ?? null
                      : null
                    : null;
                return (
                  <div key={msg.id}>
                    <MessageRow
                      ref={(el) => {
                        messageRefs.current.set(msg.id, el);
                      }}
                      message={msg}
                      messageNumber={messageIndex.get(msg.id) ?? 0}
                      citations={cits}
                      reactions={reactionMap}
                      isFocused={isFocused}
                      isInspected={isInspected}
                      isDimmed={isDimmed}
                      outlineHue={outlineHue}
                      commentCount={(commentsByMsg[msg.id] ?? []).length}
                      pickerForThis={
                        picker.kind !== "none" && picker.messageId === msg.id
                          ? picker
                          : null
                      }
                      categories={evaluation.categories}
                      popupOpen={popupOpen}
                      marginaliaReasoning={marginaliaReasoning}
                      onMouseEnter={() => setHoveredMessageId(msg.id)}
                      onMouseLeave={() => setHoveredMessageId(null)}
                      onClick={() => openInspect(msg.id)}
                      onPopupAction={(action) => {
                        if (action === "comment" || action === "inspect") {
                          openInspect(msg.id);
                        } else if (action === "cite" && msg.role === "agent") {
                          setPicker({ kind: "category", messageId: msg.id });
                        } else if (action === "react") {
                          setPicker({ kind: "reaction", messageId: msg.id });
                        }
                      }}
                      onCitationClick={() => openInspect(msg.id)}
                      onToggleReaction={(emoji) => toggleReaction(msg.id, emoji)}
                      onOpenReactionPicker={() =>
                        setPicker({ kind: "reaction", messageId: msg.id })
                      }
                      onClosePicker={() => setPicker({ kind: "none" })}
                      onPickCategory={(catId) => {
                        const added = addCitation(msg.id, catId);
                        if (added && added.scaleType !== "binary") {
                          setPicker({
                            kind: "score",
                            messageId: msg.id,
                            categoryId: catId,
                          });
                        } else {
                          setPicker({ kind: "none" });
                        }
                      }}
                      onPickScore={(score) => {
                        if (picker.kind === "score") {
                          setCitationScore(msg.id, picker.categoryId, score);
                          setPicker({ kind: "none" });
                        }
                      }}
                      onPickReaction={(emoji) => {
                        toggleReaction(msg.id, emoji);
                        setPicker({ kind: "none" });
                      }}
                    />
                    {activities.map((a) => (
                      <ActivityRow
                        key={a.id}
                        event={a}
                        dimmed={isDimmed && !isInspected}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="relative">
            <div className="sticky top-4">
              {inspectMessage ? (
                <InspectPanel
                  key={inspectMessage.id}
                  message={inspectMessage}
                  messageNumber={messageIndex.get(inspectMessage.id) ?? 0}
                  citations={citationsByMessage.get(inspectMessage.id) ?? []}
                  comments={commentsByMsg[inspectMessage.id] ?? []}
                  commentReactionsById={commentReactionsById}
                  categories={evaluation.categories}
                  pendingComment={pendingComment}
                  composerRef={composerRef}
                  hoveredCitationKey={hoveredCitationKey}
                  onHoverCitation={setHoveredCitationKey}
                  onClose={closeInspect}
                  onPendingCommentChange={setPendingComment}
                  onSubmitComment={submitComment}
                  onComposerFocus={() => setComposerFocused(true)}
                  onComposerBlur={() => setComposerFocused(false)}
                  onAddCitation={(catId) => {
                    const added = addCitation(inspectMessage.id, catId);
                    return added?.scaleType === "binary";
                  }}
                  onSetCitationScore={(catId, score) =>
                    setCitationScore(inspectMessage.id, catId, score)
                  }
                  onRemoveCitation={(catId) =>
                    removeCitation(inspectMessage.id, catId)
                  }
                  onToggleCommentReaction={toggleCommentReaction}
                />
              ) : (
                <OverviewPanel
                  evaluation={evaluation}
                  mutedCategoryId={mutedCategoryId}
                  spotlightTick={spotlightTick}
                  hoveredCategoryId={hoveredCategoryId}
                  onHoverCategory={setHoveredCategoryId}
                  onToggleMute={toggleMutedCategory}
                />
              )}
            </div>
          </aside>
        </div>

        <FooterBar hints={footerHints} />

        <Dialog open={cheatOpen} onOpenChange={setCheatOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Keyboard className="size-4" />
                Keyboard shortcuts
              </DialogTitle>
            </DialogHeader>
            <CheatSheet />
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

/* -------------------- Ticket header + prompt bar -------------------- */

function TicketHeader({ ticket }: { ticket: typeof sampleTicket }) {
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
          handled by{" "}
          <span className="text-foreground">{ticket.assignee.name}</span>
        </span>
        <span>·</span>
        <span className="capitalize">{ticket.status}</span>
      </div>
    </header>
  );
}

function PromptBar({
  activityOn,
  onToggleActivity,
  onOpenCheat,
}: {
  activityOn: boolean;
  onToggleActivity: () => void;
  onOpenCheat: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-card/40 px-3 py-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="size-4 text-primary" />
        <span>
          Hover or focus a message for actions. Use{" "}
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> to navigate,{" "}
          <button
            type="button"
            onClick={onOpenCheat}
            className="cursor-pointer underline-offset-2 hover:underline"
          >
            press <Kbd>?</Kbd> for shortcuts
          </button>
          .
        </span>
      </div>
      <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <span>Show activity</span>
        <Switch checked={activityOn} onCheckedChange={onToggleActivity} />
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

/* -------------------- Message row (bubble + marginalia gutter) -------------------- */

type PopupAction = "comment" | "cite" | "react" | "inspect";

type MessageRowProps = {
  message: SampleMessage;
  messageNumber: number;
  citations: Citation[];
  reactions: ReactionState;
  isFocused: boolean;
  isInspected: boolean;
  isDimmed: boolean;
  outlineHue: Hue | null;
  commentCount: number;
  pickerForThis: PickerMode | null;
  categories: SampleCategory[];
  popupOpen: boolean;
  marginaliaReasoning: string | null;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  onPopupAction: (action: PopupAction) => void;
  onCitationClick: () => void;
  onToggleReaction: (emoji: Reaction) => void;
  onOpenReactionPicker: () => void;
  onClosePicker: () => void;
  onPickCategory: (catId: string) => void;
  onPickScore: (score: number) => void;
  onPickReaction: (emoji: Reaction) => void;
};

function MessageRow({
  ref,
  message,
  messageNumber,
  citations,
  reactions,
  isFocused,
  isInspected,
  isDimmed,
  outlineHue,
  commentCount,
  pickerForThis,
  categories,
  popupOpen,
  marginaliaReasoning,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onPopupAction,
  onCitationClick,
  onToggleReaction,
  onOpenReactionPicker,
  onClosePicker,
  onPickCategory,
  onPickScore,
  onPickReaction,
}: MessageRowProps & { ref?: (el: HTMLDivElement | null) => void }) {
  const isAgent = message.role === "agent";
  const outlineStyles = outlineHue ? HUE[outlineHue] : null;
  const reactionEntries = Object.entries(reactions)
    .filter(([, names]) => names.length > 0) as [Reaction, string[]][];
  const hasReactions = reactionEntries.length > 0;

  return (
    <div
      ref={ref}
      data-msg-id={message.id}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        "scroll-mt-4 grid items-start gap-3 transition-all duration-300 ease-out",
        "grid-cols-[1fr_140px]",
        isDimmed && "opacity-30 blur-[0.5px]",
      )}
    >
      <div
        className={cn(
          "flex gap-3 min-w-0",
          isAgent ? "flex-row-reverse" : "flex-row",
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
            "min-w-0 max-w-[78%] flex-1 space-y-1",
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
            {/* Flag-ribbons stick out from the bubble's leading edge.
                Agent (right-side bubble) → ribbons stick out to the LEFT.
                Customer would mirror, but customers have no citations. */}
            {isAgent && citations.length > 0 && (
              <div
                className="pointer-events-none absolute top-1.5 right-full z-10 flex flex-col items-end gap-1"
                style={{ marginRight: "-4px" }}
              >
                {citations.map((c) => {
                  const cat = categories.find((x) => x.id === c.categoryId);
                  if (!cat) return null;
                  return (
                    <FlagRibbon
                      key={c.key}
                      citation={c}
                      category={cat}
                      onClick={onCitationClick}
                    />
                  );
                })}
              </div>
            )}

            {/* Ribbon-style contextual popup — slides down above the bubble */}
            {popupOpen && (
              <ContextRibbon
                isAgent={isAgent}
                showCite={isAgent}
                onAction={onPopupAction}
              />
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
              className={cn(
                "group relative inline-block max-w-full cursor-pointer rounded-2xl border px-4 py-3 pr-9 text-left text-base transition-all duration-200 ease-out",
                isAgent
                  ? "rounded-tr-sm border-primary/20 bg-primary/10 text-foreground"
                  : "rounded-tl-sm border-border bg-card text-foreground",
                "hover:-translate-y-px hover:shadow-md",
                isFocused &&
                  !isInspected &&
                  "ring-2 ring-ring ring-offset-2 ring-offset-background -translate-y-px shadow-md",
                isInspected && "ring-2 ring-primary shadow-md -translate-y-px",
                outlineStyles && cn("ring-2", outlineStyles.ring),
              )}
            >
              <span
                aria-hidden
                className="absolute right-2 top-1.5 select-none text-xs font-medium tabular-nums text-muted-foreground/60"
              >
                M{messageNumber}
              </span>
              {message.body}
            </button>
          </div>

          {/* Comment indicator + reactions + reaction-add button */}
          {(commentCount > 0 || hasReactions) && (
            <div
              className={cn(
                "flex flex-wrap items-center gap-1.5 pt-1",
                isAgent ? "justify-end" : "justify-start",
              )}
            >
              {commentCount > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                  }}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={`${commentCount} comment${commentCount === 1 ? "" : "s"}, open inspect`}
                  title="Open Inspect with comment input focused"
                >
                  <span aria-hidden>💬</span>
                  <span className="tabular-nums">{commentCount}</span>
                </button>
              )}
              {reactionEntries.map(([emoji, names]) => (
                <ReactionChip
                  key={emoji}
                  emoji={emoji}
                  names={names}
                  onClick={() => onToggleReaction(emoji)}
                />
              ))}
              <ReactionAddButton
                open={pickerForThis?.kind === "reaction"}
                onOpenChange={(open) => {
                  if (open) onOpenReactionPicker();
                  else onClosePicker();
                }}
                onPick={onPickReaction}
                reactions={reactions}
              />
            </div>
          )}

          {pickerForThis?.kind === "category" && (
            <div className={cn("pt-1.5", isAgent && "flex justify-end")}>
              <CategoryPickerInline
                categories={categories.filter(
                  (c) => !citations.some((ct) => ct.categoryId === c.id),
                )}
                onPick={onPickCategory}
                onCancel={onClosePicker}
              />
            </div>
          )}
          {pickerForThis?.kind === "score" && (
            <div className={cn("pt-1.5", isAgent && "flex justify-end")}>
              <ScorePickerInline
                category={
                  categories.find((c) => c.id === pickerForThis.categoryId) ?? null
                }
                onPick={onPickScore}
                onCancel={onClosePicker}
              />
            </div>
          )}
        </div>
      </div>

      {/* Marginalia gutter — appears in the right 140px column.
          Only renders for agent messages cited under the active category. */}
      <div className="min-h-0 self-stretch">
        {marginaliaReasoning ? (
          <p
            key={marginaliaReasoning}
            className="zen-marginalia mt-9 text-sm italic leading-snug text-muted-foreground"
          >
            {marginaliaReasoning}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------- Flag ribbon (citation) -------------------- */

function FlagRibbon({
  citation,
  category,
  onClick,
}: {
  citation: Citation;
  category: SampleCategory;
  onClick: () => void;
}) {
  const hue = CATEGORY_HUE[category.id];
  const styles = HUE[hue];
  const isBinary = category.scaleType === "binary";
  const effectiveScore = citation.score ?? category.effectiveScore;
  const scoreLabel = isBinary
    ? effectiveScore === 1
      ? "Pass"
      : "Fail"
    : `${effectiveScore}/5`;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "pointer-events-auto group inline-flex max-w-[180px] cursor-pointer items-center gap-1.5 rounded-l-md rounded-r-sm border border-r-0 bg-card/90 py-1 pl-1.5 pr-2 text-sm shadow-sm backdrop-blur-sm transition-all duration-150",
        // The color stripe is the OUTER (left) edge — like a book tab spine.
        "border-l-[3px]",
        styles.border,
        // Subtle category-tinted fill so the tab reads as related to its color.
        styles.bgSoft,
        "hover:-translate-x-px hover:shadow-md",
      )}
      title={`${category.name} · ${scoreLabel}${citation.aiSuggested ? " · AI suggested" : ""}`}
    >
      <span
        className={cn(
          "truncate text-xs font-medium uppercase tracking-wide opacity-80",
          styles.textDark,
        )}
        style={{ letterSpacing: "0.04em" }}
      >
        {category.name}
      </span>
      <span className={cn("tabular-nums text-sm font-semibold", styles.textDark)}>
        {scoreLabel}
      </span>
      {citation.aiSuggested && (
        <Sparkles
          className={cn("size-3 shrink-0", styles.text)}
          aria-label="AI suggested"
        />
      )}
    </button>
  );
}

/* -------------------- Ribbon-style contextual popup -------------------- */

function ContextRibbon({
  isAgent,
  showCite,
  onAction,
}: {
  isAgent: boolean;
  showCite: boolean;
  onAction: (action: PopupAction) => void;
}) {
  const actions: { action: PopupAction; key: string; label: string }[] = [
    { action: "comment", key: "C", label: "Comment" },
    ...(showCite ? [{ action: "cite" as PopupAction, key: "T", label: "Cite" }] : []),
    { action: "react", key: "R", label: "React" },
    { action: "inspect", key: "↵", label: "Inspect" },
  ];
  return (
    <div
      // Center horizontally over the bubble, slightly above it. The
      // `zen-ribbon-pop` keyframe applies the unroll animation; transform is
      // baked into that keyframe so it stays in sync.
      className={cn(
        "zen-ribbon-pop pointer-events-auto absolute z-20 left-1/2 -top-9 flex items-center gap-1 rounded-md border border-border bg-popover px-1.5 py-1 shadow-md",
      )}
    >
      {actions.map(({ action, key, label }) => (
        <button
          key={action}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAction(action);
          }}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 text-sm text-foreground transition-colors hover:bg-accent",
          )}
          aria-label={label}
        >
          <Kbd>{key}</Kbd>
          <span>{label}</span>
        </button>
      ))}
      {/* Decorative arrow pointing at the bubble */}
      <span
        aria-hidden
        className="absolute left-1/2 top-full -mt-px h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-border bg-popover"
      />
      {/* Reference isAgent to silence unused-var; the layout is symmetric for now. */}
      <span aria-hidden className="sr-only">
        {isAgent ? "agent" : "customer"}
      </span>
    </div>
  );
}

/* -------------------- Reaction chip + add button -------------------- */

function ReactionChip({
  emoji,
  names,
  onClick,
}: {
  emoji: Reaction;
  names: string[];
  onClick: () => void;
}) {
  const youReacted = names.includes("You");
  const displayNames =
    names.length <= 4
      ? names.join(", ")
      : `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className={cn(
            "inline-flex h-6 cursor-pointer items-center gap-1 rounded-full border px-2 text-sm transition-colors",
            youReacted
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-border bg-card text-foreground hover:bg-accent",
          )}
          aria-label={`${emoji} from ${displayNames}`}
        >
          <span aria-hidden>{emoji}</span>
          <span className="tabular-nums">{names.length}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <span className="text-sm">{displayNames}</span>
      </TooltipContent>
    </Tooltip>
  );
}

function ReactionAddButton({
  open,
  onOpenChange,
  onPick,
  reactions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (emoji: Reaction) => void;
  reactions: ReactionState;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label="Add reaction"
          className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-full border border-dashed border-border bg-transparent px-1.5 text-muted-foreground transition-colors hover:border-solid hover:bg-accent hover:text-foreground"
        >
          <span aria-hidden className="text-sm">＋</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-1"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-0.5">
          {REACTIONS.map((emoji) => {
            const youReacted = (reactions[emoji] ?? []).includes("You");
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => onPick(emoji)}
                aria-label={`React with ${emoji}`}
                className={cn(
                  "flex size-8 cursor-pointer items-center justify-center rounded-md text-lg transition-all hover:scale-110 hover:bg-accent",
                  youReacted && "bg-primary/10",
                )}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* -------------------- Inline pickers (keyboard fallback) -------------------- */

function CategoryPickerInline({
  categories,
  onPick,
  onCancel,
}: {
  categories: SampleCategory[];
  onPick: (catId: string) => void;
  onCancel: () => void;
}) {
  return (
    <div className="w-72 rounded-lg border border-dashed border-border bg-popover p-2 shadow-md animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-sm font-medium text-muted-foreground">
          Categorize — press 1–{Math.max(categories.length, 1)}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Esc
        </button>
      </div>
      {categories.length === 0 ? (
        <div className="px-2 py-1.5 text-sm text-muted-foreground">
          Cited under every category.
        </div>
      ) : (
        <ul className="space-y-0.5">
          {categories.map((cat, idx) => {
            const styles = HUE[CATEGORY_HUE[cat.id]];
            return (
              <li key={cat.id}>
                <button
                  type="button"
                  onClick={() => onPick(cat.id)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent/50"
                >
                  <Kbd>{idx + 1}</Kbd>
                  <span className={cn("size-2 shrink-0 rounded-full", styles.bg)} />
                  <span className="flex-1 truncate text-base text-foreground">
                    {cat.name}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ScorePickerInline({
  category,
  onPick,
  onCancel,
}: {
  category: SampleCategory | null;
  onPick: (n: number) => void;
  onCancel: () => void;
}) {
  if (!category) return null;
  const styles = HUE[CATEGORY_HUE[category.id]];
  return (
    <div
      className={cn(
        "w-72 rounded-lg border bg-popover p-2 shadow-md animate-in fade-in slide-in-from-top-1 duration-150",
        styles.borderSoft,
      )}
    >
      <div className="mb-1 flex items-center justify-between px-1">
        <span
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium",
            styles.textDark,
          )}
        >
          <span className={cn("size-1.5 rounded-full", styles.bg)} />
          Score {category.name} — press 1–5
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Esc
        </button>
      </div>
      <div className="flex items-center justify-between gap-1 px-1 pt-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPick(n)}
            className={cn(
              "flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-md border px-2 py-1.5 text-sm transition-all hover:scale-105",
              "border-border bg-background",
              styles.textDark,
            )}
          >
            <span className="text-base font-medium tabular-nums">{n}</span>
            <Kbd>{n}</Kbd>
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------- Overview panel (spotlight category list) -------------------- */

function OverviewPanel({
  evaluation,
  mutedCategoryId,
  spotlightTick,
  hoveredCategoryId,
  onHoverCategory,
  onToggleMute,
}: {
  evaluation: typeof sampleTicket.evaluation;
  mutedCategoryId: string | null;
  spotlightTick: number;
  hoveredCategoryId: string | null;
  onHoverCategory: (id: string | null) => void;
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
    <div className="rounded-xl border border-border bg-card/95 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-right-2 duration-200">
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
        <div className="mb-2 px-1">
          <span className="text-sm font-medium text-muted-foreground">
            Categories
          </span>
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
              hovered={hoveredCategoryId === cat.id}
              spotlightTick={spotlightTick}
              onHover={(h) => onHoverCategory(h ? cat.id : null)}
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
  hovered,
  spotlightTick,
  onHover,
  onToggle,
}: {
  category: SampleCategory;
  active: boolean;
  dimmed: boolean;
  hovered: boolean;
  spotlightTick: number;
  onHover: (hovered: boolean) => void;
  onToggle: () => void;
}) {
  const styles = HUE[CATEGORY_HUE[category.id]];
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        onFocus={() => onHover(true)}
        onBlur={() => onHover(false)}
        // Remount on each spotlight selection to re-trigger the pulse keyframe.
        key={active ? `active-${spotlightTick}` : "idle"}
        className={cn(
          "group relative w-full cursor-pointer overflow-hidden rounded-lg border px-3 py-2.5 text-left transition-all duration-300",
          active
            ? cn(styles.bgSoft, styles.border, "shadow-sm zen-glow")
            : "border-transparent bg-transparent hover:bg-accent/50",
          // Spotlight: soft-mute non-selected cards.
          dimmed && "opacity-50",
          // Slight lift on hover for the unselected, undimmed state.
          !active && hovered && "bg-accent/40",
        )}
        style={
          active
            ? ({
                ["--zen-glow-soft" as string]: `color-mix(in oklch, ${styles.glow} 30%, transparent)`,
                ["--zen-glow-mid" as string]: `color-mix(in oklch, ${styles.glow} 50%, transparent)`,
              } as React.CSSProperties)
            : undefined
        }
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
          <span
            className={cn(
              "shrink-0 text-sm font-medium tabular-nums",
              active ? styles.textDark : "text-muted-foreground",
            )}
          >
            {category.scaleType === "binary"
              ? category.effectiveScore === 1
                ? "Pass"
                : "Fail"
              : `${category.effectiveScore}/5`}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 pl-2 text-sm text-muted-foreground">
          <span>{category.weightPercent}% weight</span>
          {category.isAutofail && (
            <>
              <span aria-hidden>·</span>
              <span className="font-medium text-red-darker">Autofail</span>
            </>
          )}
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
  message,
  messageNumber,
  citations,
  comments,
  commentReactionsById,
  categories,
  pendingComment,
  composerRef,
  hoveredCitationKey,
  onHoverCitation,
  onClose,
  onPendingCommentChange,
  onSubmitComment,
  onComposerFocus,
  onComposerBlur,
  onAddCitation,
  onSetCitationScore,
  onRemoveCitation,
  onToggleCommentReaction,
}: {
  message: SampleMessage;
  messageNumber: number;
  citations: Citation[];
  comments: Comment[];
  commentReactionsById: Record<string, ReactionState>;
  categories: SampleCategory[];
  pendingComment: string;
  composerRef: React.RefObject<HTMLTextAreaElement | null>;
  hoveredCitationKey: string | null;
  onHoverCitation: (key: string | null) => void;
  onClose: () => void;
  onPendingCommentChange: (s: string) => void;
  onSubmitComment: () => void;
  onComposerFocus: () => void;
  onComposerBlur: () => void;
  onAddCitation: (catId: string) => boolean | undefined;
  onSetCitationScore: (catId: string, score: number) => void;
  onRemoveCitation: (catId: string) => void;
  onToggleCommentReaction: (commentId: string, emoji: Reaction) => void;
}) {
  const isCustomer = message.role === "customer";
  const availableCategories = categories.filter(
    (c) => !citations.some((cit) => cit.categoryId === c.id),
  );
  const [addingCategory, setAddingCategory] = useState(false);
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null);
  const pendingCategory = pendingCategoryId
    ? categories.find((c) => c.id === pendingCategoryId)
    : null;

  return (
    <div className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-card/95 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-right-2 duration-200">
      <div className="flex items-center justify-between border-b border-border bg-background/40 px-2 py-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to overview"
          className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          <span>Back</span>
        </button>
        <span className="flex items-center gap-1.5 pr-1 text-sm text-muted-foreground">
          <span>Message {messageNumber}</span>
          <span aria-hidden>·</span>
          <Kbd>Esc</Kbd>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-5 p-4">
          {!isCustomer && (
            <section>
              <SectionHeader label="Citations" />
              <div className="space-y-1.5">
                {citations.map((c) => {
                  const cat = categories.find((x) => x.id === c.categoryId);
                  if (!cat) return null;
                  const effectiveScore = c.score ?? cat.effectiveScore;
                  return (
                    <InspectCitationRow
                      key={c.key}
                      citation={c}
                      category={cat}
                      effectiveScore={effectiveScore}
                      hovered={hoveredCitationKey === c.key}
                      onHover={(h) => onHoverCitation(h ? c.key : null)}
                      onSetScore={(s) => onSetCitationScore(c.categoryId, s)}
                      onRemove={() => onRemoveCitation(c.categoryId)}
                    />
                  );
                })}

                {addingCategory && pendingCategory ? (
                  <InspectScorePicker
                    category={pendingCategory}
                    onPick={(s) => {
                      onSetCitationScore(pendingCategory.id, s);
                      setAddingCategory(false);
                      setPendingCategoryId(null);
                    }}
                    onCancel={() => {
                      onRemoveCitation(pendingCategory.id);
                      setAddingCategory(false);
                      setPendingCategoryId(null);
                    }}
                  />
                ) : addingCategory ? (
                  <InspectCategoryPicker
                    categories={availableCategories}
                    onPick={(catId) => {
                      const isBinary = onAddCitation(catId);
                      if (isBinary) {
                        setAddingCategory(false);
                      } else {
                        setPendingCategoryId(catId);
                      }
                    }}
                    onCancel={() => setAddingCategory(false)}
                  />
                ) : (
                  availableCategories.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setAddingCategory(true)}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
                    >
                      <Plus className="size-3.5" />
                      <span>Add to category…</span>
                    </button>
                  )
                )}
              </div>
            </section>
          )}

          {comments.length > 0 && (
            <section>
              <SectionHeader label="Comments" />
              <ul className="space-y-3">
                {comments.map((c) => (
                  <CommentRow
                    key={c.id}
                    comment={c}
                    reactions={commentReactionsById[c.id] ?? {}}
                    onToggleReaction={(emoji) =>
                      onToggleCommentReaction(c.id, emoji)
                    }
                  />
                ))}
              </ul>
            </section>
          )}

          <section>
            {comments.length === 0 && <SectionHeader label="Comment" />}
            <CommentComposer
              ref={composerRef}
              value={pendingComment}
              onChange={onPendingCommentChange}
              onSubmit={onSubmitComment}
              onFocus={onComposerFocus}
              onBlur={onComposerBlur}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
    </div>
  );
}

function InspectCitationRow({
  citation,
  category,
  effectiveScore,
  hovered,
  onHover,
  onSetScore,
  onRemove,
}: {
  citation: Citation;
  category: SampleCategory;
  effectiveScore: number;
  hovered: boolean;
  onHover: (hovered: boolean) => void;
  onSetScore: (s: number) => void;
  onRemove: () => void;
}) {
  const [changing, setChanging] = useState(false);
  const styles = HUE[CATEGORY_HUE[category.id]];
  const isBinary = category.scaleType === "binary";
  return (
    <div
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
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
        <span className={cn("shrink-0 text-sm tabular-nums", styles.textDark)}>
          {isBinary ? (effectiveScore === 1 ? "Pass" : "Fail") : `${effectiveScore}/5`}
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
            onClick={() => setChanging((v) => !v)}
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
          aria-label={`Remove ${category.name}`}
          className={cn(
            "shrink-0 cursor-pointer rounded-md p-1 transition-colors",
            styles.textDark,
            "hover:bg-background/70",
          )}
        >
          <X className="size-3.5" />
        </button>
      </div>
      {/* Marginalia in Inspect: AI reasoning fades in when the citation row
          is hovered/focused. Same "book annotation" vibe as the convo gutter. */}
      {hovered && citation.aiSuggested && (
        <p
          key={category.id}
          className="zen-marginalia mt-1.5 border-t border-current/10 pt-1.5 text-sm italic leading-snug text-muted-foreground"
        >
          {category.aiReasoning}
        </p>
      )}
      {changing && !isBinary && (
        <div className="mt-2 flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-150">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                onSetScore(n);
                setChanging(false);
              }}
              className={cn(
                "size-8 cursor-pointer rounded-md border text-sm font-medium tabular-nums transition-all",
                n === effectiveScore
                  ? cn(styles.bg, "border-transparent text-white shadow-sm")
                  : cn("border-border bg-background hover:scale-105", styles.textDark),
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

function InspectCategoryPicker({
  categories,
  onPick,
  onCancel,
}: {
  categories: SampleCategory[];
  onPick: (catId: string) => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-background/40 p-2">
      <div className="mb-1 flex items-center justify-between px-1 text-sm text-muted-foreground">
        <span>Pick a category</span>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>
      <ul className="space-y-0.5">
        {categories.map((cat) => {
          const styles = HUE[CATEGORY_HUE[cat.id]];
          return (
            <li key={cat.id}>
              <button
                type="button"
                onClick={() => onPick(cat.id)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent/50"
              >
                <span className={cn("size-2 rounded-full", styles.bg)} aria-hidden />
                <span className="flex-1 truncate text-base text-foreground">
                  {cat.name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function InspectScorePicker({
  category,
  onPick,
  onCancel,
}: {
  category: SampleCategory;
  onPick: (n: number) => void;
  onCancel: () => void;
}) {
  const styles = HUE[CATEGORY_HUE[category.id]];
  return (
    <div
      className={cn(
        "rounded-lg border p-2 animate-in fade-in slide-in-from-top-1 duration-150",
        styles.borderSoft,
        styles.bgSoft,
      )}
    >
      <div className="mb-1 flex items-center justify-between px-1">
        <span
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium",
            styles.textDark,
          )}
        >
          <span className={cn("size-1.5 rounded-full", styles.bg)} />
          Score {category.name}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>
      <div className="flex items-center justify-between gap-1 px-1 pt-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPick(n)}
            className={cn(
              "flex flex-1 cursor-pointer items-center justify-center rounded-md border bg-background py-1.5 text-base font-medium tabular-nums transition-all hover:scale-105",
              "border-border",
              styles.textDark,
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function CommentRow({
  comment,
  reactions,
  onToggleReaction,
}: {
  comment: Comment;
  reactions: ReactionState;
  onToggleReaction: (emoji: Reaction) => void;
}) {
  const reactionEntries = Object.entries(reactions)
    .filter(([, names]) => names.length > 0) as [Reaction, string[]][];
  const hasReactions = reactionEntries.length > 0;
  return (
    <li className="flex gap-2.5">
      <div
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground"
        aria-hidden
      >
        {comment.initials}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-baseline gap-2 text-sm">
          <span className="font-medium text-foreground">{comment.author}</span>
          <span className="text-muted-foreground">
            {formatRelative(comment.createdAt)}
          </span>
        </div>
        <p className="text-left text-base text-foreground">{comment.body}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {reactionEntries.map(([emoji, names]) => (
            <ReactionChip
              key={emoji}
              emoji={emoji}
              names={names}
              onClick={() => onToggleReaction(emoji)}
            />
          ))}
          <CommentReactionAdd
            reactions={reactions}
            onPick={onToggleReaction}
            subtle={!hasReactions}
          />
        </div>
      </div>
    </li>
  );
}

function CommentReactionAdd({
  reactions,
  onPick,
  subtle,
}: {
  reactions: ReactionState;
  onPick: (emoji: Reaction) => void;
  subtle: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Add reaction to comment"
          className={cn(
            "inline-flex h-5 cursor-pointer items-center gap-1 rounded-full border border-dashed px-1.5 text-xs transition-colors",
            subtle
              ? "border-transparent text-muted-foreground/60 opacity-0 hover:opacity-100 group-hover:opacity-100"
              : "border-border text-muted-foreground hover:border-solid hover:bg-accent hover:text-foreground",
          )}
        >
          <span aria-hidden>＋</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-1">
        <div className="flex items-center gap-0.5">
          {REACTIONS.map((emoji) => {
            const youReacted = (reactions[emoji] ?? []).includes("You");
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onPick(emoji);
                  setOpen(false);
                }}
                aria-label={`React with ${emoji}`}
                className={cn(
                  "flex size-8 cursor-pointer items-center justify-center rounded-md text-lg transition-all hover:scale-110 hover:bg-accent",
                  youReacted && "bg-primary/10",
                )}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CommentComposer({
  ref,
  value,
  onChange,
  onSubmit,
  onFocus,
  onBlur,
}: {
  ref: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (s: string) => void;
  onSubmit: () => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  const canSubmit = value.trim().length > 0;
  return (
    <div className="relative">
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder="Add a coaching note…"
        className="min-h-20 resize-none pb-10 text-base"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
      />
      {/* Submit button baked inside the composer */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className={cn(
          "absolute bottom-2 right-2 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-sm font-medium text-primary-foreground transition-opacity",
          "disabled:cursor-not-allowed disabled:opacity-40",
        )}
      >
        <Send className="size-3.5" />
        <span>Submit</span>
        <span className="flex items-center gap-0.5 opacity-80">
          <Kbd>⌘</Kbd>
          <Kbd>↵</Kbd>
        </span>
      </button>
    </div>
  );
}

/* -------------------- Footer hint bar + cheat sheet -------------------- */

function FooterBar({
  hints,
}: {
  hints: { keys: string[]; label: string }[] | null;
}) {
  if (!hints) return null;
  return (
    <div className="fixed bottom-3 left-1/2 z-30 -translate-x-1/2">
      <div className="flex h-8 items-center gap-2 rounded-full border border-border bg-popover/95 px-4 shadow-md backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
        {hints.map((h, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="flex items-center gap-0.5">
              {h.keys.map((k, ki) => (
                <Kbd key={ki}>{k}</Kbd>
              ))}
            </span>
            <span className="text-sm text-muted-foreground">{h.label}</span>
            {i < hints.length - 1 && (
              <span className="text-muted-foreground/40" aria-hidden>
                ·
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

function CheatSheet() {
  const groups: { title: string; rows: { keys: string[]; desc: string }[] }[] = [
    {
      title: "Navigate",
      rows: [
        { keys: ["↑", "↓"], desc: "Move focus" },
        { keys: ["J", "K"], desc: "Move focus (vim)" },
        { keys: ["↵"], desc: "Inspect focused message" },
      ],
    },
    {
      title: "Inspect",
      rows: [
        { keys: ["Esc"], desc: "Back / blur composer (multi-step)" },
      ],
    },
    {
      title: "Coach",
      rows: [
        { keys: ["C"], desc: "Comment (opens Inspect)" },
        { keys: ["T"], desc: "Cite (agent messages only)" },
        { keys: ["R"], desc: "React" },
      ],
    },
    {
      title: "Pickers",
      rows: [
        { keys: ["1", "…", "5"], desc: "Pick category / score" },
        { keys: ["1", "…", "6"], desc: "Pick reaction" },
        { keys: ["Esc"], desc: "Cancel" },
      ],
    },
    {
      title: "Compose",
      rows: [
        { keys: ["⌘", "↵"], desc: "Post comment" },
        { keys: ["Esc"], desc: "Blur composer" },
      ],
    },
    {
      title: "Help",
      rows: [{ keys: ["?"], desc: "Toggle this cheat sheet" }],
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {groups.map((g) => (
        <div key={g.title}>
          <div className="mb-1.5 text-sm font-medium text-muted-foreground">
            {g.title}
          </div>
          <ul className="space-y-1">
            {g.rows.map((r, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 text-base text-foreground"
              >
                <span>{r.desc}</span>
                <span className="flex shrink-0 items-center gap-0.5">
                  {r.keys.map((k, ki) => (
                    <Kbd key={ki}>{k}</Kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
