"use client";

/**
 * Round-6 "tight" — the conservative refinement.
 *
 * Built on round-5 flow. Adds the contextual on-message popup (icon-only,
 * shows on hover OR keyboard focus, with proper bg-popover so no text bleed),
 * unifies coaching flows inside Inspect (citation chip click focuses that row;
 * comment indicator opens Inspect with composer focused; bubble click opens
 * Inspect with composer focused), and surfaces AI reasoning inline beneath
 * the focused citation row. Reactions stay inline under the bubble.
 *
 * Bugs fixed from flow:
 *  - Single-letter shortcuts (C/T/R) no longer fire while typing in a textarea.
 *  - Popup background is opaque; sender name/time underneath never bleed through.
 *  - "Clear" button removed from the sidebar — Esc or click-outside deselects.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CircleDot,
  CornerDownLeft,
  Keyboard,
  MessageSquarePlus,
  Plus,
  SmilePlus,
  Sparkles,
  Tag,
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

/** What the Inspect panel should focus when it opens (or after re-entering). */
type InspectFocus =
  | { kind: "comment" }
  | { kind: "citation"; key: string };

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
      body: 'Tighten "within the hour" → wall-clock time on the close (Message 7). Otherwise excellent.',
      createdAt: "2026-05-21T09:22:00Z",
    },
  ],
};

const INITIAL_REACTIONS: Record<string, ReactionState> = {
  msg_3: { "🔥": ["Ana Rivera", "Diego Park"], "✨": ["Sam Okafor"] },
  msg_5: { "❤️": ["Ana Rivera"], "👍": ["Diego Park", "Sam Okafor", "Maya Lin"] },
  msg_7: { "✨": ["Ana Rivera"] },
};

const ACTIVITIES: ActivityEvent[] = [
  { id: "act_1", afterMessageId: "msg_1", label: "Assigned to Marisol Tate (Front line)" },
  { id: "act_2", afterMessageId: "msg_2", label: "Marisol opened order BB-48721 in fulfillment console" },
  { id: "act_3", afterMessageId: "msg_5", label: 'Recovery offer template applied: "overnight reship"' },
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

/* -------------------- Page -------------------- */

export default function TightMockupPage() {
  const ticket = sampleTicket;
  const { evaluation, messages } = ticket;

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [inspectFocus, setInspectFocus] = useState<InspectFocus>({
    kind: "comment",
  });
  const [inspectAddingCategory, setInspectAddingCategory] = useState(false);
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null);
  const [mutedCategoryId, setMutedCategoryId] = useState<string | null>(null);
  const [activityOn, setActivityOn] = useState(false);
  const [citations, setCitations] = useState<Citation[]>(INITIAL_CITATIONS);
  const [commentsByMsg, setCommentsByMsg] =
    useState<Record<string, Comment[]>>(INITIAL_COMMENTS);
  const [reactionsByMsg, setReactionsByMsg] =
    useState<Record<string, ReactionState>>(INITIAL_REACTIONS);
  const [reactionTrayMessageId, setReactionTrayMessageId] = useState<
    string | null
  >(null);
  const [pendingComment, setPendingComment] = useState("");
  const [composerFocused, setComposerFocused] = useState(false);
  const [cheatOpen, setCheatOpen] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);

  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const sidebarRef = useRef<HTMLElement | null>(null);

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

  const openInspect = useCallback(
    (id: string, focus: InspectFocus, opts?: { addCitation?: boolean }) => {
      setInspectId(id);
      setFocusedId(id);
      setMutedCategoryId(null);
      setReactionTrayMessageId(null);
      setInspectFocus(focus);
      setPendingComment("");
      setInspectAddingCategory(opts?.addCitation ?? false);
      setPendingCategoryId(null);
      if (focus.kind === "comment") {
        requestAnimationFrame(() => composerRef.current?.focus());
      }
    },
    [],
  );

  const closeInspect = useCallback(() => {
    setInspectId(null);
    setPendingComment("");
    setInspectAddingCategory(false);
    setPendingCategoryId(null);
    setInspectFocus({ kind: "comment" });
  }, []);

  function addCitation(
    messageId: string,
    categoryId: string,
  ): SampleCategory | null {
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

  /** Flash a message bubble briefly — used when AI reasoning's "Message N"
   *  chip is clicked to scroll & highlight the target. */
  const flashMessage = useCallback((id: string) => {
    const el = messageRefs.current.get(id);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashId(id);
    setTimeout(() => setFlashId((v) => (v === id ? null : v)), 1400);
  }, []);

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

      // `?` toggles cheat sheet anywhere except when typing
      if (e.key === "?" && !isTyping) {
        e.preventDefault();
        setCheatOpen((v) => !v);
        return;
      }
      if (cheatOpen) return; // Dialog owns its own keys

      /* Multi-Esc: peel one layer at a time.
       *   1. Close inline reaction tray
       *   2. Close any open Inspect picker
       *   3. Blur composer (stays in Inspect)
       *   4. Exit Inspect
       *   5. Clear category mute
       *   6. No-op at root
       */
      if (e.key === "Escape") {
        if (reactionTrayMessageId) {
          e.preventDefault();
          setReactionTrayMessageId(null);
          return;
        }
        if (inspectAddingCategory || pendingCategoryId) {
          e.preventDefault();
          if (pendingCategoryId && inspectId) {
            // Roll back the citation we tentatively added.
            removeCitation(inspectId, pendingCategoryId);
          }
          setInspectAddingCategory(false);
          setPendingCategoryId(null);
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

      // CRITICAL: single-letter shortcuts MUST NOT fire while typing.
      // Cmd+Enter is handled by the textarea itself. Esc handled above.
      if (isTyping) return;

      // Inside the Inspect "add citation" picker — numeric category select.
      if (inspectAddingCategory && !pendingCategoryId && inspectId) {
        const available = evaluation.categories.filter(
          (c) =>
            !citations.some(
              (cit) => cit.messageId === inspectId && cit.categoryId === c.id,
            ),
        );
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= available.length) {
          e.preventDefault();
          const cat = available[n - 1];
          const added = addCitation(inspectId, cat.id);
          if (!added) return;
          if (added.scaleType === "binary") {
            setInspectAddingCategory(false);
          } else {
            setPendingCategoryId(cat.id);
          }
        }
        return;
      }
      // Inside the Inspect "score the new citation" picker.
      if (pendingCategoryId && inspectId) {
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= 5) {
          e.preventDefault();
          setCitationScore(inspectId, pendingCategoryId, n);
          setInspectAddingCategory(false);
          setPendingCategoryId(null);
        }
        return;
      }
      // Inside the inline reaction tray — numeric reaction select.
      if (reactionTrayMessageId) {
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= REACTIONS.length) {
          e.preventDefault();
          toggleReaction(reactionTrayMessageId, REACTIONS[n - 1]);
          setReactionTrayMessageId(null);
        }
        return;
      }

      // Navigation.
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
            openInspect(focusedId, { kind: "comment" });
          }
          return;
      }

      // Action keys (focused message required).
      if (!focusedId) return;
      const focused = messages.find((m) => m.id === focusedId);
      if (!focused) return;

      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        openInspect(focusedId, { kind: "comment" });
        return;
      }
      if (e.key === "t" || e.key === "T") {
        // Customer messages aren't categorize-able.
        if (focused.role !== "agent") return;
        e.preventDefault();
        openInspect(focusedId, { kind: "comment" }, { addCitation: true });
        return;
      }
      if (e.key === "r" || e.key === "R") {
        // Reactions stay inline — they do NOT open Inspect.
        e.preventDefault();
        setReactionTrayMessageId(focusedId);
        return;
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cheatOpen,
    reactionTrayMessageId,
    inspectAddingCategory,
    pendingCategoryId,
    inspectId,
    mutedCategoryId,
    focusedId,
    messages,
    evaluation.categories,
    citations,
    moveFocus,
    openInspect,
    closeInspect,
  ]);

  /* ---- Side effects ---- */

  // Smooth-scroll focused into view.
  useEffect(() => {
    if (!focusedId) return;
    const el = messageRefs.current.get(focusedId);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusedId]);

  // Auto-scroll first cited message to top of viewport when a category is
  // selected in the sidebar.
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

  // Click outside the sidebar's category card deselects the category filter.
  // Defer attaching by one tick so the same click that selected a category
  // doesn't immediately clear it.
  useEffect(() => {
    if (!mutedCategoryId) return;
    function onDocClick(e: MouseEvent) {
      const el = sidebarRef.current;
      if (!el) return;
      const node = e.target as Node | null;
      if (node && !el.contains(node)) {
        setMutedCategoryId(null);
      }
    }
    const t = window.setTimeout(
      () => document.addEventListener("click", onDocClick),
      0,
    );
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("click", onDocClick);
    };
  }, [mutedCategoryId]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="relative pb-12">
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
                const isHovered = hoveredId === msg.id;
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
                const reactionTrayOpen = reactionTrayMessageId === msg.id;
                return (
                  <div key={msg.id}>
                    <MessageBubble
                      ref={(el) => {
                        messageRefs.current.set(msg.id, el);
                      }}
                      message={msg}
                      messageNumber={messageIndex.get(msg.id) ?? 0}
                      citations={cits}
                      reactions={reactionMap}
                      categories={evaluation.categories}
                      isFocused={isFocused}
                      isHovered={isHovered}
                      isInspected={isInspected}
                      isDimmed={isDimmed}
                      isFlashing={flashId === msg.id}
                      outlineHue={outlineHue}
                      hasComments={(commentsByMsg[msg.id] ?? []).length > 0}
                      reactionTrayOpen={reactionTrayOpen}
                      onHoverChange={(h) => setHoverState(setHoveredId, msg.id, h)}
                      onFocusKeyboard={() => setFocusedId(msg.id)}
                      onClickBubble={() =>
                        openInspect(msg.id, { kind: "comment" })
                      }
                      onClickComment={() =>
                        openInspect(msg.id, { kind: "comment" })
                      }
                      onClickCite={() => {
                        if (msg.role !== "agent") return;
                        openInspect(
                          msg.id,
                          { kind: "comment" },
                          { addCitation: true },
                        );
                      }}
                      onClickReact={() => setReactionTrayMessageId(msg.id)}
                      onClickInspect={() =>
                        openInspect(msg.id, { kind: "comment" })
                      }
                      onClickCitationChip={(catId) =>
                        openInspect(msg.id, {
                          kind: "citation",
                          key: `${msg.id}::${catId}`,
                        })
                      }
                      onToggleReaction={(emoji) =>
                        toggleReaction(msg.id, emoji)
                      }
                      onOpenReactionTray={() =>
                        setReactionTrayMessageId(msg.id)
                      }
                      onCloseReactionTray={() => setReactionTrayMessageId(null)}
                      onPickReaction={(emoji) => {
                        toggleReaction(msg.id, emoji);
                        setReactionTrayMessageId(null);
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

          {/* Sticky right column — always present. */}
          <aside className="relative" ref={sidebarRef}>
            <div className="sticky top-4">
              {inspectMessage ? (
                <InspectPanel
                  key={inspectMessage.id}
                  message={inspectMessage}
                  messageNumber={messageIndex.get(inspectMessage.id) ?? 0}
                  messageIndex={messageIndex}
                  citations={citationsByMessage.get(inspectMessage.id) ?? []}
                  comments={commentsByMsg[inspectMessage.id] ?? []}
                  categories={evaluation.categories}
                  pendingComment={pendingComment}
                  composerRef={composerRef}
                  inspectFocus={inspectFocus}
                  addingCategory={inspectAddingCategory}
                  pendingCategoryId={pendingCategoryId}
                  onClose={closeInspect}
                  onPendingCommentChange={setPendingComment}
                  onSubmitComment={submitComment}
                  onComposerFocus={() => setComposerFocused(true)}
                  onComposerBlur={() => setComposerFocused(false)}
                  onFocusCitation={(key) =>
                    setInspectFocus({ kind: "citation", key })
                  }
                  onFocusComposer={() => setInspectFocus({ kind: "comment" })}
                  onStartAddCitation={() => setInspectAddingCategory(true)}
                  onCancelAddCitation={() => {
                    if (pendingCategoryId) {
                      removeCitation(inspectMessage.id, pendingCategoryId);
                    }
                    setInspectAddingCategory(false);
                    setPendingCategoryId(null);
                  }}
                  onPickCategory={(catId) => {
                    const added = addCitation(inspectMessage.id, catId);
                    if (!added) return;
                    if (added.scaleType === "binary") {
                      setInspectAddingCategory(false);
                    } else {
                      setPendingCategoryId(catId);
                    }
                  }}
                  onPickPendingScore={(score) => {
                    if (!pendingCategoryId) return;
                    setCitationScore(
                      inspectMessage.id,
                      pendingCategoryId,
                      score,
                    );
                    setInspectAddingCategory(false);
                    setPendingCategoryId(null);
                  }}
                  onSetCitationScore={(catId, score) =>
                    setCitationScore(inspectMessage.id, catId, score)
                  }
                  onRemoveCitation={(catId) =>
                    removeCitation(inspectMessage.id, catId)
                  }
                  onJumpToMessage={(id) => flashMessage(id)}
                />
              ) : (
                <OverviewPanel
                  evaluation={evaluation}
                  mutedCategoryId={mutedCategoryId}
                  onToggleMute={(id) =>
                    setMutedCategoryId((curr) => (curr === id ? null : id))
                  }
                />
              )}
            </div>
          </aside>
        </div>

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

        {/* Hidden composer-focused indicator — used to keep the state in
            the dependency graph without rendering anything. */}
        {composerFocused ? <span aria-hidden className="sr-only" /> : null}
      </div>
    </TooltipProvider>
  );
}

function setHoverState(
  setter: (v: string | null) => void,
  id: string,
  hovering: boolean,
) {
  setter(hovering ? id : null);
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
          Hover any message for actions. Use <Kbd>↑</Kbd> <Kbd>↓</Kbd> to
          navigate,{" "}
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

/* -------------------- Message bubble -------------------- */

type MessageBubbleProps = {
  message: SampleMessage;
  messageNumber: number;
  citations: Citation[];
  reactions: ReactionState;
  categories: SampleCategory[];
  isFocused: boolean;
  isHovered: boolean;
  isInspected: boolean;
  isDimmed: boolean;
  isFlashing: boolean;
  outlineHue: Hue | null;
  hasComments: boolean;
  reactionTrayOpen: boolean;
  onHoverChange: (h: boolean) => void;
  onFocusKeyboard: () => void;
  onClickBubble: () => void;
  onClickComment: () => void;
  onClickCite: () => void;
  onClickReact: () => void;
  onClickInspect: () => void;
  onClickCitationChip: (categoryId: string) => void;
  onToggleReaction: (emoji: Reaction) => void;
  onOpenReactionTray: () => void;
  onCloseReactionTray: () => void;
  onPickReaction: (emoji: Reaction) => void;
};

function MessageBubble({
  ref,
  message,
  messageNumber,
  citations,
  reactions,
  categories,
  isFocused,
  isHovered,
  isInspected,
  isDimmed,
  isFlashing,
  outlineHue,
  hasComments,
  reactionTrayOpen,
  onHoverChange,
  onClickBubble,
  onClickComment,
  onClickCite,
  onClickReact,
  onClickInspect,
  onClickCitationChip,
  onToggleReaction,
  onOpenReactionTray,
  onCloseReactionTray,
  onPickReaction,
}: MessageBubbleProps & { ref?: (el: HTMLDivElement | null) => void }) {
  const isAgent = message.role === "agent";
  const isCustomer = message.role === "customer";
  const outlineStyles = outlineHue ? HUE[outlineHue] : null;
  const reactionEntries = Object.entries(reactions).filter(
    ([, names]) => names.length > 0,
  ) as [Reaction, string[]][];
  const hasReactions = reactionEntries.length > 0;

  // Popup visibility: keyboard focus OR mouse hover.
  const popupVisible = isFocused || isHovered;

  return (
    <div
      ref={ref}
      data-msg-id={message.id}
      className={cn(
        "scroll-mt-4 flex gap-3 transition-all duration-300 ease-out",
        isAgent ? "flex-row-reverse" : "flex-row",
        isDimmed && "opacity-30 blur-[0.5px]",
      )}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
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
          "relative min-w-0 max-w-[78%] flex-1 space-y-1",
          isAgent ? "items-end text-right" : "items-start",
        )}
      >
        {/* Contextual popup — sits above the sender row with an 8px gap,
            opaque bg-popover so the text underneath never bleeds through. */}
        {popupVisible && (
          <BubblePopup
            isAgent={isAgent}
            disableCite={isCustomer}
            onComment={onClickComment}
            onCite={onClickCite}
            onReact={onClickReact}
            onInspect={onClickInspect}
          />
        )}

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
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClickBubble();
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
              isFlashing && "ring-2 ring-ring shadow-lg -translate-y-px",
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

        {/* Citation chips + comment indicator + reactions */}
        {(citations.length > 0 ||
          hasComments ||
          hasReactions ||
          reactionTrayOpen ||
          popupVisible) && (
          <div
            className={cn(
              "flex flex-wrap items-center gap-1.5 pt-1",
              isAgent ? "justify-end" : "justify-start",
            )}
          >
            {citations.map((c) => {
              const cat = categories.find((x) => x.id === c.categoryId);
              if (!cat) return null;
              return (
                <CitationChip
                  key={c.key}
                  citation={c}
                  category={cat}
                  onClick={() => onClickCitationChip(c.categoryId)}
                />
              );
            })}
            {hasComments && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClickComment();
                }}
                aria-label="Open comments"
                className="inline-flex h-6 cursor-pointer items-center justify-center rounded-full border border-border bg-card/60 px-2 text-muted-foreground transition-colors hover:-translate-y-px hover:bg-accent hover:text-foreground hover:shadow-sm"
              >
                <MessageSquarePlus className="size-3.5" aria-hidden />
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
            {(hasReactions || reactionTrayOpen) && (
              <ReactionAddButton
                open={reactionTrayOpen}
                onOpenChange={(open) => {
                  if (open) onOpenReactionTray();
                  else onCloseReactionTray();
                }}
                onPick={onPickReaction}
                reactions={reactions}
              />
            )}
          </div>
        )}

        {/* Inline reaction tray for keyboard `R` flow when no reactions yet.
            This is a fallback render when the chip-row above doesn't include
            the add-button (e.g. no existing reactions). */}
        {reactionTrayOpen && !hasReactions && (
          <div className={cn("pt-1.5", isAgent && "flex justify-end")}>
            <ReactionTrayInline
              reactions={reactions}
              onPick={onPickReaction}
              onCancel={onCloseReactionTray}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------- Contextual on-message popup -------------------- */

function BubblePopup({
  isAgent,
  disableCite,
  onComment,
  onCite,
  onReact,
  onInspect,
}: {
  isAgent: boolean;
  disableCite: boolean;
  onComment: () => void;
  onCite: () => void;
  onReact: () => void;
  onInspect: () => void;
}) {
  return (
    <div
      // Bubble column is `relative`. Sit above the sender row with an 8px gap.
      // bg-popover + shadow + border give a fully opaque surface so nothing
      // underneath bleeds through (the round-5 bug).
      className={cn(
        "absolute bottom-full z-20 mb-2 flex items-stretch gap-1 rounded-lg border border-border bg-popover p-1 shadow-md animate-in fade-in slide-in-from-bottom-1 duration-150",
        isAgent ? "right-0" : "left-0",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <PopupButton
        icon={<MessageSquarePlus className="size-4" />}
        kbd="C"
        label="Comment"
        onClick={onComment}
      />
      <PopupButton
        icon={<Tag className="size-4" />}
        kbd="T"
        label={disableCite ? "Cite (agent messages only)" : "Cite"}
        onClick={onCite}
        disabled={disableCite}
      />
      <PopupButton
        icon={<SmilePlus className="size-4" />}
        kbd="R"
        label="React"
        onClick={onReact}
      />
      <PopupButton
        icon={<CornerDownLeft className="size-4" />}
        kbd="↵"
        label="Inspect"
        onClick={onInspect}
      />
    </div>
  );
}

function PopupButton({
  icon,
  kbd,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  kbd: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onClick();
          }}
          className={cn(
            "flex w-9 flex-col items-center gap-0.5 rounded-md px-1 py-1 transition-colors",
            disabled
              ? "cursor-not-allowed text-muted-foreground/40"
              : "cursor-pointer text-foreground hover:bg-accent",
          )}
        >
          {icon}
          <Kbd>{kbd}</Kbd>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-sm">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/* -------------------- Citation chip (under bubble) -------------------- */

function CitationChip({
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
        // No colored circle. Category color is a subtle 2px left border tint;
        // the rest of the chip uses neutral border to keep the chip calm.
        "inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-l-2 bg-card/60 px-2 py-0.5 text-sm font-medium text-foreground shadow-sm transition-all hover:-translate-y-px hover:shadow-md",
        styles.border,
        "border-y-border border-r-border",
        styles.bgSoft,
      )}
    >
      <span className={cn("min-w-0 truncate", styles.textDark)}>
        {category.name}
      </span>
      <span className={cn("opacity-50", styles.textDark)}>·</span>
      <span className={cn("tabular-nums", styles.textDark)}>{scoreLabel}</span>
      {citation.aiSuggested && (
        <Sparkles
          className={cn("size-2.5 shrink-0", styles.text)}
          aria-label="AI suggested"
        />
      )}
    </button>
  );
}

/* -------------------- Reaction chip + add button + tray -------------------- */

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
          <SmilePlus className="size-3.5" />
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

function ReactionTrayInline({
  reactions,
  onPick,
  onCancel,
}: {
  reactions: ReactionState;
  onPick: (emoji: Reaction) => void;
  onCancel: () => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-md animate-in fade-in slide-in-from-top-1 duration-150">
      {REACTIONS.map((emoji, idx) => {
        const youReacted = (reactions[emoji] ?? []).includes("You");
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onPick(emoji)}
            aria-label={`React with ${emoji}`}
            className={cn(
              "flex size-8 cursor-pointer flex-col items-center justify-center rounded-md transition-all hover:scale-110 hover:bg-accent",
              youReacted && "bg-primary/10",
            )}
          >
            <span className="text-base leading-none">{emoji}</span>
            <Kbd>{idx + 1}</Kbd>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onCancel}
        className="ml-1 cursor-pointer rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        Esc
      </button>
    </div>
  );
}

/* -------------------- Overview panel (sidebar default) -------------------- */

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
              dimmed={mutedCategoryId !== null && mutedCategoryId !== cat.id}
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
  const styles = HUE[CATEGORY_HUE[category.id]];
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
  messageIndex,
  citations,
  comments,
  categories,
  pendingComment,
  composerRef,
  inspectFocus,
  addingCategory,
  pendingCategoryId,
  onClose,
  onPendingCommentChange,
  onSubmitComment,
  onComposerFocus,
  onComposerBlur,
  onFocusCitation,
  onFocusComposer,
  onStartAddCitation,
  onCancelAddCitation,
  onPickCategory,
  onPickPendingScore,
  onSetCitationScore,
  onRemoveCitation,
  onJumpToMessage,
}: {
  message: SampleMessage;
  messageNumber: number;
  messageIndex: Map<string, number>;
  citations: Citation[];
  comments: Comment[];
  categories: SampleCategory[];
  pendingComment: string;
  composerRef: React.RefObject<HTMLTextAreaElement | null>;
  inspectFocus: InspectFocus;
  addingCategory: boolean;
  pendingCategoryId: string | null;
  onClose: () => void;
  onPendingCommentChange: (s: string) => void;
  onSubmitComment: () => void;
  onComposerFocus: () => void;
  onComposerBlur: () => void;
  onFocusCitation: (key: string) => void;
  onFocusComposer: () => void;
  onStartAddCitation: () => void;
  onCancelAddCitation: () => void;
  onPickCategory: (catId: string) => void;
  onPickPendingScore: (score: number) => void;
  onSetCitationScore: (catId: string, score: number) => void;
  onRemoveCitation: (catId: string) => void;
  onJumpToMessage: (messageId: string) => void;
}) {
  const isCustomer = message.role === "customer";
  const availableCategories = categories.filter(
    (c) => !citations.some((cit) => cit.categoryId === c.id),
  );
  const pendingCategory = pendingCategoryId
    ? categories.find((c) => c.id === pendingCategoryId) ?? null
    : null;
  const focusedKey =
    inspectFocus.kind === "citation" ? inspectFocus.key : null;

  return (
    <div className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-card/95 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-right-2 duration-200">
      {/* Header: ← Back · Esc on the left; Message N right-justified chip. */}
      <div className="flex items-center justify-between border-b border-border bg-background/40 px-2 py-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to overview"
          className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          <span>Back</span>
          <span aria-hidden className="text-muted-foreground/60">
            ·
          </span>
          <Kbd>Esc</Kbd>
        </button>
        <span className="pr-1 text-xs text-muted-foreground">
          Message {messageNumber}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-5 p-4">
          {/* Citations (agent only). No header when empty, no count. */}
          {!isCustomer && (citations.length > 0 || availableCategories.length > 0) && (
            <section>
              {citations.length > 0 && (
                <div className="mb-2 px-1">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Citations
                  </h3>
                </div>
              )}
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
                      focused={focusedKey === c.key}
                      onFocus={() => onFocusCitation(c.key)}
                      onSetScore={(s) => onSetCitationScore(c.categoryId, s)}
                      onRemove={() => onRemoveCitation(c.categoryId)}
                      reasoning={cat.aiReasoning}
                      messageIndex={messageIndex}
                      onJumpToMessage={onJumpToMessage}
                    />
                  );
                })}

                {addingCategory && pendingCategory ? (
                  <InspectScorePicker
                    category={pendingCategory}
                    onPick={onPickPendingScore}
                    onCancel={onCancelAddCitation}
                  />
                ) : addingCategory ? (
                  <InspectCategoryPicker
                    categories={availableCategories}
                    onPick={onPickCategory}
                    onCancel={onCancelAddCitation}
                  />
                ) : (
                  availableCategories.length > 0 && (
                    <button
                      type="button"
                      onClick={onStartAddCitation}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
                    >
                      <Plus className="size-3.5" />
                      <span>Add citation</span>
                    </button>
                  )
                )}
              </div>
            </section>
          )}

          {/* Comments — render NOTHING when empty (no empty state). */}
          {comments.length > 0 && (
            <section>
              <div className="mb-2 px-1">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Comments
                </h3>
              </div>
              <ul className="space-y-3">
                {comments.map((c) => (
                  <CommentRow key={c.id} comment={c} />
                ))}
              </ul>
            </section>
          )}

          {/* Composer — always present. Auto-focused on Inspect open via
              the page's openInspect effect. */}
          <section>
            <CommentComposer
              ref={composerRef}
              value={pendingComment}
              onChange={onPendingCommentChange}
              onSubmit={onSubmitComment}
              onFocus={() => {
                onComposerFocus();
                onFocusComposer();
              }}
              onBlur={onComposerBlur}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

function InspectCitationRow({
  citation,
  category,
  effectiveScore,
  focused,
  onFocus,
  onSetScore,
  onRemove,
  reasoning,
  messageIndex,
  onJumpToMessage,
}: {
  citation: Citation;
  category: SampleCategory;
  effectiveScore: number;
  focused: boolean;
  onFocus: () => void;
  onSetScore: (s: number) => void;
  onRemove: () => void;
  reasoning: string;
  messageIndex: Map<string, number>;
  onJumpToMessage: (messageId: string) => void;
}) {
  const styles = HUE[CATEGORY_HUE[category.id]];
  const isBinary = category.scaleType === "binary";
  return (
    <div
      className={cn(
        "rounded-lg border transition-all",
        styles.borderSoft,
        styles.bgSoft,
        focused && "shadow-sm ring-1 ring-inset",
        focused && styles.ring,
      )}
    >
      <button
        type="button"
        onClick={onFocus}
        className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left"
      >
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
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${category.name}`}
          className={cn(
            "shrink-0 cursor-pointer rounded-md p-1 transition-colors",
            styles.textDark,
            "hover:bg-background/70",
          )}
        >
          <X className="size-3.5" />
        </button>
      </button>
      {focused && (
        <div className="space-y-2 px-3 pb-2.5 pt-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
          {!isBinary && (
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onSetScore(n)}
                  className={cn(
                    "size-8 cursor-pointer rounded-md border text-sm font-medium tabular-nums transition-all hover:scale-105",
                    n === effectiveScore
                      ? cn(styles.bg, "border-transparent text-white shadow-sm")
                      : cn(
                          "border-border bg-background",
                          styles.textDark,
                        ),
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
          <p className="text-sm italic text-muted-foreground">
            <ReasoningText
              text={reasoning}
              messageIndex={messageIndex}
              onJump={onJumpToMessage}
            />
          </p>
        </div>
      )}
    </div>
  );
}

/** Render reasoning text with `msg_N` tokens replaced by clickable
 *  "Message N" chips that scroll-and-flash the referenced bubble. */
function ReasoningText({
  text,
  messageIndex,
  onJump,
}: {
  text: string;
  messageIndex: Map<string, number>;
  onJump: (messageId: string) => void;
}) {
  const parts: React.ReactNode[] = [];
  const re = /msg_(\d+)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      parts.push(text.slice(lastIndex, m.index));
    }
    const msgId = `msg_${m[1]}`;
    const n = messageIndex.get(msgId);
    parts.push(
      <button
        key={`r${i++}`}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onJump(msgId);
        }}
        className="cursor-pointer rounded-sm bg-accent/60 px-1 not-italic text-foreground transition-colors hover:bg-accent"
      >
        Message {n ?? m[1]}
      </button>,
    );
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return <>{parts}</>;
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
        <span>Pick a category — press 1–{Math.max(categories.length, 1)}</span>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer transition-colors hover:text-foreground"
        >
          Esc
        </button>
      </div>
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
                <span
                  className={cn("size-2 shrink-0 rounded-full", styles.bg)}
                  aria-hidden
                />
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

function CommentRow({ comment }: { comment: Comment }) {
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
      </div>
    </li>
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
  return (
    <div>
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder="Add a coaching note…"
        className="min-h-16 resize-none text-base"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
      />
      <div className="mt-1.5 flex items-center justify-end">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!value.trim()}
          className={cn(
            "inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          <span>Submit</span>
          <span className="flex items-center gap-0.5">
            <Kbd>⌘</Kbd>
            <Kbd>↵</Kbd>
          </span>
        </button>
      </div>
    </div>
  );
}

/* -------------------- Cheat sheet -------------------- */

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
      rows: [{ keys: ["Esc"], desc: "Back / blur composer (multi-step)" }],
    },
    {
      title: "Coach",
      rows: [
        { keys: ["C"], desc: "Comment (opens Inspect)" },
        { keys: ["T"], desc: "Cite (agent messages only)" },
        { keys: ["R"], desc: "React (inline tray)" },
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
