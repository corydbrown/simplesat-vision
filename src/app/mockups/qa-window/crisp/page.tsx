"use client";

/**
 * Round-6 crisp: same feature set as sibling `tight`, but three alt visual
 * choices: (1) contextual popup shows icon + label + kbd hint stacked for
 * discoverability, (2) Inspect uses Comments/Citations tabs with Comments
 * default, (3) AI reasoning is collapsed behind a per-row ℹ toggle.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  CircleDot,
  CornerDownLeft,
  Info,
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

type InspectTab = "comments" | "citations";

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
  c1: { "👍": ["Diego Park"] },
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

/* -------------------- Page -------------------- */

export default function CrispMockupPage() {
  const ticket = sampleTicket;
  const { evaluation, messages } = ticket;

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [inspectTab, setInspectTab] = useState<InspectTab>("comments");
  const [mutedCategoryId, setMutedCategoryId] = useState<string | null>(null);
  const [activityOn, setActivityOn] = useState(false);
  const [citations, setCitations] = useState<Citation[]>(INITIAL_CITATIONS);
  const [commentsByMsg, setCommentsByMsg] =
    useState<Record<string, Comment[]>>(INITIAL_COMMENTS);
  const [reactionsByMsg, setReactionsByMsg] =
    useState<Record<string, ReactionState>>(INITIAL_REACTIONS);
  const [reactionsByComment, setReactionsByComment] = useState<
    Record<string, ReactionState>
  >(INITIAL_COMMENT_REACTIONS);
  const [pendingComment, setPendingComment] = useState("");
  const [picker, setPicker] = useState<PickerMode>({ kind: "none" });
  const [composerFocused, setComposerFocused] = useState(false);
  const [cheatOpen, setCheatOpen] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [focusCitationKey, setFocusCitationKey] = useState<string | null>(null);

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
    (
      id: string,
      opts: { tab?: InspectTab; citationKey?: string } = {},
    ) => {
      setInspectId(id);
      setFocusedId(id);
      setMutedCategoryId(null);
      closeAllOverlays();
      setPendingComment("");
      const msg = messages.find((m) => m.id === id);
      const isCustomer = msg?.role === "customer";
      const nextTab: InspectTab = isCustomer
        ? "comments"
        : opts.tab ?? "comments";
      setInspectTab(nextTab);
      setFocusCitationKey(opts.citationKey ?? null);
      // Auto-focus the comment input only when landing on the comments tab.
      if (nextTab === "comments") {
        requestAnimationFrame(() => {
          composerRef.current?.focus();
        });
      }
    },
    [closeAllOverlays, messages],
  );

  const closeInspect = useCallback(() => {
    setInspectId(null);
    setPendingComment("");
    setFocusCitationKey(null);
    closeAllOverlays();
  }, [closeAllOverlays]);

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
    setReactionsByComment((prev) => {
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

  const scrollToMessage = useCallback((id: string) => {
    const el = messageRefs.current.get(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashId(id);
    window.setTimeout(() => setFlashId((curr) => (curr === id ? null : curr)), 1200);
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

      if (e.key === "?" && !isTyping) {
        e.preventDefault();
        setCheatOpen((v) => !v);
        return;
      }
      if (cheatOpen) return;

      /* Multi-Esc: peel one layer at a time. */
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

      // Picker number handling.
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

      // Tab switching inside Inspect (only for agent messages where both
      // tabs are meaningful). 1 = Comments, 2 = Citations.
      if (inspectId) {
        const msg = messages.find((m) => m.id === inspectId);
        const isAgent = msg?.role === "agent";
        if (e.key === "1") {
          e.preventDefault();
          setInspectTab("comments");
          requestAnimationFrame(() => composerRef.current?.focus());
          return;
        }
        if (e.key === "2" && isAgent) {
          e.preventDefault();
          setInspectTab("citations");
          composerRef.current?.blur();
          return;
        }
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
            openInspect(focusedId);
          }
          return;
      }

      // Action keys.
      if (!focusedId) return;
      const focused = messages.find((m) => m.id === focusedId);
      if (!focused) return;

      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        openInspect(focusedId, { tab: "comments" });
        return;
      }
      if (e.key === "t" || e.key === "T") {
        if (focused.role !== "agent") return;
        e.preventDefault();
        openInspect(focusedId, { tab: "citations" });
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
      const msg = messages.find((m) => m.id === inspectId);
      const isAgent = msg?.role === "agent";
      const hints: { keys: string[]; label: string }[] = [
        { keys: ["1"], label: "comments" },
      ];
      if (isAgent) hints.push({ keys: ["2"], label: "citations" });
      hints.push({ keys: ["Esc"], label: "exit" });
      hints.push({ keys: ["?"], label: "more" });
      return hints;
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
      <div className="relative pb-16">
        <div className="grid grid-cols-[1fr_400px] gap-6">
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
                const showPopup =
                  !inspectId && !isDimmed && (isFocused || isHovered);
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
                      isFocused={isFocused}
                      isInspected={isInspected}
                      isDimmed={isDimmed}
                      isFlashing={flashId === msg.id}
                      outlineHue={outlineHue}
                      commentCount={(commentsByMsg[msg.id] ?? []).length}
                      pickerForThis={
                        picker.kind !== "none" && picker.messageId === msg.id
                          ? picker
                          : null
                      }
                      showPopup={showPopup}
                      categories={evaluation.categories}
                      onHover={(over) =>
                        setHoveredId((curr) => (over ? msg.id : curr === msg.id ? null : curr))
                      }
                      onClickBubble={() =>
                        openInspect(msg.id, { tab: "comments" })
                      }
                      onClickCommentIcon={() =>
                        openInspect(msg.id, { tab: "comments" })
                      }
                      onClickCitation={(catId) =>
                        openInspect(msg.id, {
                          tab: "citations",
                          citationKey: `${msg.id}::${catId}`,
                        })
                      }
                      onPopupComment={() =>
                        openInspect(msg.id, { tab: "comments" })
                      }
                      onPopupCite={() => {
                        setFocusedId(msg.id);
                        setPicker({ kind: "category", messageId: msg.id });
                      }}
                      onPopupReact={() => {
                        setFocusedId(msg.id);
                        setPicker({ kind: "reaction", messageId: msg.id });
                      }}
                      onPopupInspect={() => openInspect(msg.id)}
                      onChangeScore={(catId, score) =>
                        setCitationScore(msg.id, catId, score)
                      }
                      onRemoveCitation={(catId) => removeCitation(msg.id, catId)}
                      onToggleReaction={(emoji) => toggleReaction(msg.id, emoji)}
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
                  categories={evaluation.categories}
                  pendingComment={pendingComment}
                  composerRef={composerRef}
                  tab={inspectTab}
                  onTabChange={setInspectTab}
                  focusCitationKey={focusCitationKey}
                  commentReactions={reactionsByComment}
                  onToggleCommentReaction={toggleCommentReaction}
                  onScrollToMessage={scrollToMessage}
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
          Hover or focus a message — actions surface above it.{" "}
          <button
            type="button"
            onClick={onOpenCheat}
            className="cursor-pointer underline-offset-2 hover:underline"
          >
            Press <Kbd>?</Kbd> for shortcuts
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
  isFocused: boolean;
  isInspected: boolean;
  isDimmed: boolean;
  isFlashing: boolean;
  outlineHue: Hue | null;
  commentCount: number;
  pickerForThis: PickerMode | null;
  showPopup: boolean;
  categories: SampleCategory[];
  onHover: (over: boolean) => void;
  onClickBubble: () => void;
  onClickCommentIcon: () => void;
  onClickCitation: (catId: string) => void;
  onPopupComment: () => void;
  onPopupCite: () => void;
  onPopupReact: () => void;
  onPopupInspect: () => void;
  onChangeScore: (categoryId: string, score: number) => void;
  onRemoveCitation: (categoryId: string) => void;
  onToggleReaction: (emoji: Reaction) => void;
  onClosePicker: () => void;
  onPickCategory: (catId: string) => void;
  onPickScore: (score: number) => void;
  onPickReaction: (emoji: Reaction) => void;
};

function MessageBubble({
  ref,
  message,
  messageNumber,
  citations,
  reactions,
  isFocused,
  isInspected,
  isDimmed,
  isFlashing,
  outlineHue,
  commentCount,
  pickerForThis,
  showPopup,
  categories,
  onHover,
  onClickBubble,
  onClickCommentIcon,
  onClickCitation,
  onPopupComment,
  onPopupCite,
  onPopupReact,
  onPopupInspect,
  onChangeScore,
  onRemoveCitation,
  onToggleReaction,
  onClosePicker,
  onPickCategory,
  onPickScore,
  onPickReaction,
}: MessageBubbleProps & { ref?: (el: HTMLDivElement | null) => void }) {
  const isAgent = message.role === "agent";
  const outlineStyles = outlineHue ? HUE[outlineHue] : null;
  const reactionEntries = Object.entries(reactions)
    .filter(([, names]) => names.length > 0) as [Reaction, string[]][];
  const hasReactions = reactionEntries.length > 0;
  const canCite = isAgent;

  return (
    <div
      ref={ref}
      data-msg-id={message.id}
      className={cn(
        "scroll-mt-4 flex gap-3 transition-all duration-300 ease-out",
        isAgent ? "flex-row-reverse" : "flex-row",
        isDimmed && "opacity-30 blur-[0.5px]",
      )}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
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
        {/* Contextual popup. Anchored to the top of the WHOLE column
            (above sender row) so it never overlaps name/time. */}
        {showPopup && (
          <ContextPopup
            isAgent={isAgent}
            canCite={canCite}
            onComment={onPopupComment}
            onCite={onPopupCite}
            onReact={onPopupReact}
            onInspect={onPopupInspect}
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
              isFlashing && "ring-2 ring-primary shadow-lg",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute right-2 top-1.5 select-none text-xs font-medium tabular-nums text-muted-foreground/60",
              )}
            >
              M{messageNumber}
            </span>
            {message.body}
          </button>
        </div>

        {/* Citation chips + comment icon + reaction chips */}
        {(citations.length > 0 || commentCount > 0 || hasReactions) && (
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
                  onClickChip={() => onClickCitation(c.categoryId)}
                  onChangeScore={(score) => onChangeScore(c.categoryId, score)}
                  onRemove={() => onRemoveCitation(c.categoryId)}
                />
              );
            })}
            {commentCount > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClickCommentIcon();
                }}
                className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-full border border-border bg-card px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label={`${commentCount} comment${commentCount === 1 ? "" : "s"} — open Inspect`}
                title={`${commentCount} comment${commentCount === 1 ? "" : "s"}`}
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
          </div>
        )}

        {/* Inline picker for keyboard / popup-driven category / score / reaction flow */}
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
        {pickerForThis?.kind === "reaction" && (
          <div className={cn("pt-1.5", isAgent && "flex justify-end")}>
            <ReactionPickerInline
              reactions={reactions}
              onPick={onPickReaction}
              onCancel={onClosePicker}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------- Contextual popup (icon + label + kbd stacked) -------------------- */

function ContextPopup({
  isAgent,
  canCite,
  onComment,
  onCite,
  onReact,
  onInspect,
}: {
  isAgent: boolean;
  canCite: boolean;
  onComment: () => void;
  onCite: () => void;
  onReact: () => void;
  onInspect: () => void;
}) {
  return (
    <div
      className={cn(
        "pointer-events-auto absolute bottom-full z-20 mb-1.5 flex items-stretch gap-1 rounded-lg border border-border bg-popover p-1 shadow-md animate-in fade-in slide-in-from-bottom-1 duration-150",
        isAgent ? "right-0" : "left-0",
      )}
      role="toolbar"
      aria-label="Message actions"
      // Stop clicks here from bubbling to the bubble's click handler.
      onClick={(e) => e.stopPropagation()}
    >
      <PopupAction
        icon="💬"
        label="Comment"
        kbd="C"
        onClick={onComment}
      />
      <PopupAction
        icon="🏷"
        label="Cite"
        kbd="T"
        onClick={onCite}
        disabled={!canCite}
        disabledTitle="Citations are agent-message only"
      />
      <PopupAction icon="😀" label="React" kbd="R" onClick={onReact} />
      <PopupActionInspect onClick={onInspect} />
    </div>
  );
}

function PopupAction({
  icon,
  label,
  kbd,
  onClick,
  disabled,
  disabledTitle,
}: {
  icon: string;
  label: string;
  kbd: string;
  onClick: () => void;
  disabled?: boolean;
  disabledTitle?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick();
      }}
      disabled={disabled}
      title={disabled ? disabledTitle : undefined}
      className={cn(
        "flex w-16 flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-foreground transition-colors",
        disabled
          ? "cursor-not-allowed opacity-40"
          : "cursor-pointer hover:bg-accent",
      )}
    >
      <span className="text-lg leading-none" aria-hidden>
        {icon}
      </span>
      <span className="text-sm font-medium leading-tight">{label}</span>
      <Kbd className="mt-0.5">{kbd}</Kbd>
    </button>
  );
}

function PopupActionInspect({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex w-16 cursor-pointer flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-foreground transition-colors hover:bg-accent"
    >
      <CornerDownLeft className="size-4" aria-hidden />
      <span className="text-sm font-medium leading-tight">Inspect</span>
      <Kbd className="mt-0.5">↵</Kbd>
    </button>
  );
}

/* -------------------- Citation chip (under bubble) -------------------- */

function CitationChip({
  citation,
  category,
  onClickChip,
  onChangeScore,
  onRemove,
}: {
  citation: Citation;
  category: SampleCategory;
  onClickChip: () => void;
  onChangeScore: (score: number) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [showScorePicker, setShowScorePicker] = useState(false);
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
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClickChip();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1.5 rounded-full border-l-2 border-y border-r bg-card/60 px-2 py-0.5 text-sm font-medium text-foreground shadow-sm transition-all",
          "hover:-translate-y-px hover:shadow-md",
          styles.border,
          "border-y-border border-r-border",
          styles.bgSoft,
        )}
      >
        <span className={cn("min-w-0 truncate", styles.textDark)}>
          {category.name}
        </span>
        <span className={cn("opacity-50", styles.textDark)}>·</span>
        <span className={cn("tabular-nums", styles.textDark)}>
          {scoreLabel}
        </span>
        {citation.aiSuggested && (
          <Sparkles
            className={cn("size-2.5 shrink-0", styles.text)}
            aria-label="AI suggested"
          />
        )}
      </button>
      <Popover
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setShowScorePicker(false);
        }}
      >
        <PopoverTrigger asChild>
          <span className="absolute inset-0 pointer-events-none" />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-56 p-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {showScorePicker && !isBinary ? (
            <div className="space-y-2 p-1">
              <div
                className={cn(
                  "flex items-center gap-1.5 text-sm font-medium",
                  styles.textDark,
                )}
              >
                <span className={cn("size-1.5 rounded-full", styles.bg)} />
                Score {category.name}
              </div>
              <div className="flex items-center justify-between gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      onChangeScore(n);
                      setShowScorePicker(false);
                      setOpen(false);
                    }}
                    className={cn(
                      "size-8 cursor-pointer rounded-md border text-sm font-medium tabular-nums transition-all hover:scale-105",
                      n === effectiveScore
                        ? cn(styles.bg, "border-transparent text-white shadow-sm")
                        : cn("border-border bg-background", styles.textDark),
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {!isBinary && (
                <li>
                  <button
                    type="button"
                    onClick={() => setShowScorePicker(true)}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-base text-foreground transition-colors hover:bg-accent"
                  >
                    <span>Change score</span>
                    <span className="ml-auto text-sm text-muted-foreground tabular-nums">
                      {scoreLabel}
                    </span>
                  </button>
                </li>
              )}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onRemove();
                    setOpen(false);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-base text-red-darker transition-colors hover:bg-red-lighter"
                >
                  <X className="size-3.5" />
                  <span>Remove citation</span>
                </button>
              </li>
            </ul>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* -------------------- Reaction chip (under bubble) -------------------- */

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

/* -------------------- Inline pickers (keyboard + popup) -------------------- */

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

function ReactionPickerInline({
  reactions,
  onPick,
  onCancel,
}: {
  reactions: ReactionState;
  onPick: (emoji: Reaction) => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-popover p-1.5 shadow-md animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-sm font-medium text-muted-foreground">
          React — press 1–6
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Esc
        </button>
      </div>
      <div className="flex items-center gap-0.5 px-1">
        {REACTIONS.map((emoji, idx) => {
          const youReacted = (reactions[emoji] ?? []).includes("You");
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => onPick(emoji)}
              aria-label={`React with ${emoji}`}
              className={cn(
                "flex size-10 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md text-lg transition-all hover:scale-110 hover:bg-accent",
                youReacted && "bg-primary/10",
              )}
            >
              <span aria-hidden>{emoji}</span>
              <Kbd>{idx + 1}</Kbd>
            </button>
          );
        })}
      </div>
    </div>
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

/* -------------------- Inspect panel (tabs variant) -------------------- */

function InspectPanel({
  message,
  messageNumber,
  citations,
  comments,
  categories,
  pendingComment,
  composerRef,
  tab,
  onTabChange,
  focusCitationKey,
  commentReactions,
  onToggleCommentReaction,
  onScrollToMessage,
  onClose,
  onPendingCommentChange,
  onSubmitComment,
  onComposerFocus,
  onComposerBlur,
  onAddCitation,
  onSetCitationScore,
  onRemoveCitation,
}: {
  message: SampleMessage;
  messageNumber: number;
  citations: Citation[];
  comments: Comment[];
  categories: SampleCategory[];
  pendingComment: string;
  composerRef: React.RefObject<HTMLTextAreaElement | null>;
  tab: InspectTab;
  onTabChange: (t: InspectTab) => void;
  focusCitationKey: string | null;
  commentReactions: Record<string, ReactionState>;
  onToggleCommentReaction: (commentId: string, emoji: Reaction) => void;
  onScrollToMessage: (id: string) => void;
  onClose: () => void;
  onPendingCommentChange: (s: string) => void;
  onSubmitComment: () => void;
  onComposerFocus: () => void;
  onComposerBlur: () => void;
  onAddCitation: (catId: string) => boolean | undefined;
  onSetCitationScore: (catId: string, score: number) => void;
  onRemoveCitation: (catId: string) => void;
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
  const effectiveTab: InspectTab = isCustomer ? "comments" : tab;

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

      {/* Tabs — `Comments` default, `Citations` hidden for customer messages */}
      <div className="flex items-center gap-1 border-b border-border bg-background/20 px-2 py-1.5">
        <TabButton
          label="Comments"
          kbd="1"
          active={effectiveTab === "comments"}
          hasItems={comments.length > 0}
          onClick={() => {
            onTabChange("comments");
            requestAnimationFrame(() => composerRef.current?.focus());
          }}
        />
        {!isCustomer && (
          <TabButton
            label="Citations"
            kbd="2"
            active={effectiveTab === "citations"}
            hasItems={citations.length > 0}
            onClick={() => {
              onTabChange("citations");
              composerRef.current?.blur();
            }}
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-5 p-4">
          {effectiveTab === "citations" && !isCustomer && (
            <section>
              <div className="space-y-1.5">
                {citations.map((c) => {
                  const cat = categories.find((x) => x.id === c.categoryId);
                  if (!cat) return null;
                  const effectiveScore = c.score ?? cat.effectiveScore;
                  return (
                    <InspectCitationRow
                      key={`${c.key}::${focusCitationKey === c.key ? "focus" : "rest"}`}
                      citation={c}
                      category={cat}
                      effectiveScore={effectiveScore}
                      autoOpenReasoning={focusCitationKey === c.key}
                      onSetScore={(s) => onSetCitationScore(c.categoryId, s)}
                      onRemove={() => onRemoveCitation(c.categoryId)}
                      onScrollToMessage={onScrollToMessage}
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

          {effectiveTab === "comments" && (
            <>
              {comments.length > 0 && (
                <section>
                  <ul className="space-y-3">
                    {comments.map((c) => (
                      <CommentRow
                        key={c.id}
                        comment={c}
                        reactions={commentReactions[c.id] ?? {}}
                        onToggleReaction={(emoji) =>
                          onToggleCommentReaction(c.id, emoji)
                        }
                      />
                    ))}
                  </ul>
                </section>
              )}
              <section>
                <CommentComposer
                  ref={composerRef}
                  value={pendingComment}
                  onChange={onPendingCommentChange}
                  onSubmit={onSubmitComment}
                  onFocus={onComposerFocus}
                  onBlur={onComposerBlur}
                />
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  label,
  kbd,
  active,
  hasItems,
  onClick,
}: {
  label: string;
  kbd: string;
  active: boolean;
  hasItems: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      <span>{label}</span>
      {hasItems && (
        <span
          aria-label={`${label} has items`}
          className={cn(
            "size-1.5 rounded-full",
            active ? "bg-primary" : "bg-green",
          )}
        />
      )}
      <Kbd
        className={cn(
          "ml-1 transition-opacity",
          active ? "opacity-100" : "opacity-50 group-hover:opacity-100",
        )}
      >
        {kbd}
      </Kbd>
    </button>
  );
}

/* -------------------- Inspect citation row (collapsible ℹ reasoning) -------------------- */

function InspectCitationRow({
  citation,
  category,
  effectiveScore,
  autoOpenReasoning,
  onSetScore,
  onRemove,
  onScrollToMessage,
}: {
  citation: Citation;
  category: SampleCategory;
  effectiveScore: number;
  autoOpenReasoning: boolean;
  onSetScore: (s: number) => void;
  onRemove: () => void;
  onScrollToMessage: (id: string) => void;
}) {
  const [changing, setChanging] = useState(false);
  const [showReasoning, setShowReasoning] = useState(autoOpenReasoning);
  const styles = HUE[CATEGORY_HUE[category.id]];
  const isBinary = category.scaleType === "binary";
  const reasoning = category.aiReasoning;

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 transition-colors",
        styles.borderSoft,
        styles.bgSoft,
        autoOpenReasoning && "ring-2 ring-offset-1 ring-offset-background",
        autoOpenReasoning && styles.ring,
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
          <>
            <Sparkles
              className={cn("size-3 shrink-0 opacity-80", styles.text)}
              aria-label="AI suggested"
            />
            <button
              type="button"
              onClick={() => setShowReasoning((v) => !v)}
              aria-label={
                showReasoning ? "Hide AI reasoning" : "Show AI reasoning"
              }
              aria-expanded={showReasoning}
              title={showReasoning ? "Hide reasoning" : "Why this citation"}
              className={cn(
                "shrink-0 cursor-pointer rounded-md p-1 transition-colors",
                showReasoning
                  ? cn(styles.bg, "text-white")
                  : cn(styles.textDark, "hover:bg-background/70"),
              )}
            >
              <Info className="size-3.5" />
            </button>
          </>
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
      {showReasoning && citation.aiSuggested && (
        <p
          className={cn(
            "mt-2 text-sm italic text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-150",
          )}
        >
          <ReasoningWithMessageRefs
            text={reasoning}
            onClickMessage={onScrollToMessage}
          />
        </p>
      )}
    </div>
  );
}

/* Render AI reasoning with clickable Message-N chips for inline `msg_N`
 * references. Falls back to plain text if no refs are found. */
function ReasoningWithMessageRefs({
  text,
  onClickMessage,
}: {
  text: string;
  onClickMessage: (id: string) => void;
}) {
  const parts = useMemo(() => {
    const out: Array<{ kind: "text"; value: string } | { kind: "ref"; id: string; n: number }> = [];
    const re = /msg_(\d+)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) {
        out.push({ kind: "text", value: text.slice(last, m.index) });
      }
      const n = Number(m[1]);
      out.push({ kind: "ref", id: `msg_${n}`, n });
      last = re.lastIndex;
    }
    if (last < text.length) {
      out.push({ kind: "text", value: text.slice(last) });
    }
    return out;
  }, [text]);

  return (
    <>
      {parts.map((p, i) =>
        p.kind === "text" ? (
          <span key={i}>{p.value}</span>
        ) : (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClickMessage(p.id);
            }}
            className="not-italic mx-0.5 inline-flex cursor-pointer items-center rounded bg-background/60 px-1 py-0 text-sm font-medium text-foreground underline-offset-2 hover:underline"
          >
            Message {p.n}
          </button>
        ),
      )}
    </>
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
        <span className="flex items-center gap-1.5">
          <Tag className="size-3.5" />
          Pick a category
        </span>
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const reactionEntries = Object.entries(reactions)
    .filter(([, names]) => names.length > 0) as [Reaction, string[]][];
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
        {(reactionEntries.length > 0 || pickerOpen) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {reactionEntries.map(([emoji, names]) => (
              <ReactionChip
                key={emoji}
                emoji={emoji}
                names={names}
                onClick={() => onToggleReaction(emoji)}
              />
            ))}
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Add reaction to comment"
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
                    const youReacted = (reactions[emoji] ?? []).includes(
                      "You",
                    );
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          onToggleReaction(emoji);
                          setPickerOpen(false);
                        }}
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
          </div>
        )}
        {reactionEntries.length === 0 && !pickerOpen && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="mt-1 inline-flex h-6 cursor-pointer items-center gap-1 rounded-full px-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <SmilePlus className="size-3.5" />
          </button>
        )}
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
            "inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          <span>Submit</span>
          <span className="flex items-center gap-0.5">
            <Kbd className="bg-primary-foreground/10 text-primary-foreground">
              ⌘
            </Kbd>
            <Kbd className="bg-primary-foreground/10 text-primary-foreground">
              ↵
            </Kbd>
          </span>
        </button>
      </div>
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
      title: "Inspect tabs",
      rows: [
        { keys: ["1"], desc: "Comments tab" },
        { keys: ["2"], desc: "Citations tab (agent)" },
        { keys: ["Esc"], desc: "Back / blur (multi-step)" },
      ],
    },
    {
      title: "Coach",
      rows: [
        { keys: ["C"], desc: "Comment (opens Inspect)" },
        { keys: ["T"], desc: "Categorize (agent messages only)" },
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
