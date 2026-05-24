"use client";

/**
 * Distilled — Round 5 yes-experiments.
 *
 * Variant decisions (vs. sibling `flow`):
 *  - Citation chips use a 5-dot scale (●●●●○) instead of numeric "4/5".
 *  - Category picker is a 2x3 grid (icons + label), keys 1-5 map to cells.
 *  - Reactions appear on COMMENTS as well as messages (Notion pattern).
 *  - Cheat sheet is a floating top-right peek panel, not a centered Dialog.
 *
 * Hard rules from brief: two-col sticky layout always; AI adds categories
 * only; M-labels on bubbles; curated 6 reactions; no inline comments;
 * no related-activity; multi-Esc; hotkey hints UNDER buttons.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ArrowLeft,
  CheckCheck,
  GitFork,
  Heart,
  Keyboard,
  MessageSquarePlus,
  Plus,
  Search,
  ShieldCheck,
  Smile,
  Sparkles,
  Tag,
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

/* -------------------- Category hues + icons -------------------- */

type Hue = "blue" | "green" | "yellow" | "purple" | "teal";

const CATEGORY_HUE: Record<string, Hue> = {
  cat_acknowledge: "blue",
  cat_diagnose: "green",
  cat_options: "yellow",
  cat_followthrough: "purple",
  cat_policy: "teal",
};

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  cat_acknowledge: Heart,
  cat_diagnose: Search,
  cat_options: GitFork,
  cat_followthrough: CheckCheck,
  cat_policy: ShieldCheck,
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
    dotFill: string;
    dotEmpty: string;
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
    dotFill: "bg-blue",
    dotEmpty: "bg-blue/20",
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
    dotFill: "bg-green",
    dotEmpty: "bg-green/20",
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
    dotFill: "bg-yellow",
    dotEmpty: "bg-yellow/20",
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
    dotFill: "bg-purple",
    dotEmpty: "bg-purple/20",
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
    dotFill: "bg-teal",
    dotEmpty: "bg-teal/20",
  },
};

/* -------------------- Reactions -------------------- */

const REACTIONS = ["👀", "👍", "❤️", "🔥", "✨", "😬"] as const;
type Reaction = (typeof REACTIONS)[number];

/* -------------------- Local state shapes -------------------- */

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

type ReactionState = {
  emoji: Reaction;
  reactors: string[];
};

type ActivityEvent = {
  id: string;
  afterMessageId: string;
  label: string;
};

type CommentReactions = Record<string, ReactionState[]>;
type MessageReactions = Record<string, ReactionState[]>;

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

const INITIAL_MSG_REACTIONS: MessageReactions = {
  msg_3: [
    { emoji: "🔥", reactors: ["Ana Rivera", "Diego Park"] },
  ],
  msg_5: [
    { emoji: "❤️", reactors: ["Ana Rivera"] },
    { emoji: "👍", reactors: ["Ana Rivera", "Diego Park", "Marisol Tate"] },
  ],
  msg_7: [
    { emoji: "✨", reactors: ["Diego Park"] },
  ],
};

const INITIAL_COMMENT_REACTIONS: CommentReactions = {
  c1: [{ emoji: "👍", reactors: ["Diego Park", "Marisol Tate"] }],
  c3: [{ emoji: "🔥", reactors: ["Diego Park"] }],
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
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* -------------------- Picker state machine -------------------- */

type Picker =
  | { kind: "none" }
  | { kind: "category"; messageId: string; target: "bubble" | "inspect" }
  | {
      kind: "score";
      messageId: string;
      categoryId: string;
      target: "bubble" | "inspect";
    }
  | { kind: "reaction"; messageId: string; target: "message" | "comment"; commentId?: string };

/* ================================================================== */

export default function DistilledMockupPage() {
  const ticket = sampleTicket;
  const { evaluation, messages } = ticket;

  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [mutedCategoryId, setMutedCategoryId] = useState<string | null>(null);
  const [activityOn, setActivityOn] = useState(false);
  const [citations, setCitations] = useState<Citation[]>(INITIAL_CITATIONS);
  const [commentsByMsg, setCommentsByMsg] =
    useState<Record<string, Comment[]>>(INITIAL_COMMENTS);
  const [msgReactions, setMsgReactions] =
    useState<MessageReactions>(INITIAL_MSG_REACTIONS);
  const [commentReactions, setCommentReactions] =
    useState<CommentReactions>(INITIAL_COMMENT_REACTIONS);

  const [pendingComment, setPendingComment] = useState("");
  const [picker, setPicker] = useState<Picker>({ kind: "none" });
  const [cheatOpen, setCheatOpen] = useState(false);

  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const focusedMessage = messages[focusedIndex] ?? null;
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

  const activityByMessage = useMemo(() => {
    const m = new Map<string, ActivityEvent[]>();
    for (const a of ACTIVITIES) {
      const arr = m.get(a.afterMessageId) ?? [];
      arr.push(a);
      m.set(a.afterMessageId, arr);
    }
    return m;
  }, []);

  /* ---------- Scroll behavior ---------- */

  // Scroll focused message into view when changed by keyboard.
  useEffect(() => {
    if (!focusedMessage) return;
    const el = messageRefs.current.get(focusedMessage.id);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusedMessage]);

  // Click-category in sidebar → mute + auto-scroll first cited to top.
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

  // Auto-focus composer when inspect opens.
  useEffect(() => {
    if (!inspectId) return;
    const id = requestAnimationFrame(() => {
      composerRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [inspectId]);

  /* ---------- Mutations ---------- */

  function moveFocus(delta: number) {
    setFocusedIndex((i) =>
      Math.min(messages.length - 1, Math.max(0, i + delta)),
    );
  }

  function addCitation(messageId: string, categoryId: string, score: number | null = null) {
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
          score,
          aiSuggested: false,
        },
      ];
    });
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

  function toggleMessageReaction(messageId: string, emoji: Reaction) {
    setMsgReactions((prev) => {
      const list = prev[messageId] ?? [];
      const existing = list.find((r) => r.emoji === emoji);
      if (existing) {
        const reactors = existing.reactors.includes("You")
          ? existing.reactors.filter((r) => r !== "You")
          : [...existing.reactors, "You"];
        const next = reactors.length === 0
          ? list.filter((r) => r.emoji !== emoji)
          : list.map((r) =>
              r.emoji === emoji ? { ...r, reactors } : r,
            );
        return { ...prev, [messageId]: next };
      }
      return {
        ...prev,
        [messageId]: [...list, { emoji, reactors: ["You"] }],
      };
    });
  }

  function toggleCommentReaction(commentId: string, emoji: Reaction) {
    setCommentReactions((prev) => {
      const list = prev[commentId] ?? [];
      const existing = list.find((r) => r.emoji === emoji);
      if (existing) {
        const reactors = existing.reactors.includes("You")
          ? existing.reactors.filter((r) => r !== "You")
          : [...existing.reactors, "You"];
        const next = reactors.length === 0
          ? list.filter((r) => r.emoji !== emoji)
          : list.map((r) =>
              r.emoji === emoji ? { ...r, reactors } : r,
            );
        return { ...prev, [commentId]: next };
      }
      return {
        ...prev,
        [commentId]: [...list, { emoji, reactors: ["You"] }],
      };
    });
  }

  /* ---------- Multi-Esc layer pop ---------- */

  const popLayer = useCallback(() => {
    if (cheatOpen) {
      setCheatOpen(false);
      return true;
    }
    if (picker.kind !== "none") {
      setPicker({ kind: "none" });
      return true;
    }
    if (inspectId) {
      setInspectId(null);
      setPendingComment("");
      return true;
    }
    if (mutedCategoryId) {
      setMutedCategoryId(null);
      return true;
    }
    return false;
  }, [cheatOpen, picker, inspectId, mutedCategoryId]);

  /* ---------- Global keyboard handler ---------- */

  useEffect(() => {
    function handler(e: globalThis.KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "TEXTAREA" || target.tagName === "INPUT";

      // ? cheat sheet — only when not typing
      if (e.key === "?" && !isTyping) {
        e.preventDefault();
        setCheatOpen((v) => !v);
        return;
      }

      // Esc always pops the topmost layer (works from textarea too).
      if (e.key === "Escape") {
        if (popLayer()) {
          e.preventDefault();
          return;
        }
      }

      // Cmd/Ctrl+Enter inside textarea posts the comment.
      if (
        isTyping &&
        e.key === "Enter" &&
        (e.metaKey || e.ctrlKey)
      ) {
        e.preventDefault();
        submitComment();
        return;
      }

      // While composing, let other keys flow normally into the textarea.
      if (isTyping) return;

      if (cheatOpen) {
        // Cheat sheet open swallows non-Esc/?-key shortcuts.
        return;
      }

      /* Picker mode — number keys + Esc */
      if (picker.kind === "category") {
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= evaluation.categories.length) {
          e.preventDefault();
          const cat = evaluation.categories[n - 1];
          if (cat.scaleType === "binary") {
            addCitation(picker.messageId, cat.id, 1);
            setPicker({ kind: "none" });
          } else {
            addCitation(picker.messageId, cat.id, null);
            setPicker({
              kind: "score",
              messageId: picker.messageId,
              categoryId: cat.id,
              target: picker.target,
            });
          }
        }
        return;
      }

      if (picker.kind === "score") {
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= 5) {
          e.preventDefault();
          setCitationScore(picker.messageId, picker.categoryId, n);
          setPicker({ kind: "none" });
        }
        return;
      }

      if (picker.kind === "reaction") {
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= REACTIONS.length) {
          e.preventDefault();
          const emoji = REACTIONS[n - 1];
          if (picker.target === "comment" && picker.commentId) {
            toggleCommentReaction(picker.commentId, emoji);
          } else {
            toggleMessageReaction(picker.messageId, emoji);
          }
          setPicker({ kind: "none" });
        }
        return;
      }

      /* Bubble navigation */
      switch (e.key) {
        case "ArrowDown":
        case "j":
        case "J":
          e.preventDefault();
          moveFocus(1);
          if (inspectId) {
            const nextId = messages[Math.min(messages.length - 1, focusedIndex + 1)]?.id;
            if (nextId) setInspectId(nextId);
          }
          return;
        case "ArrowUp":
        case "k":
        case "K":
          e.preventDefault();
          moveFocus(-1);
          if (inspectId) {
            const prevId = messages[Math.max(0, focusedIndex - 1)]?.id;
            if (prevId) setInspectId(prevId);
          }
          return;
        case "Home":
          e.preventDefault();
          setFocusedIndex(0);
          if (inspectId) setInspectId(messages[0]?.id ?? null);
          return;
        case "End":
          e.preventDefault();
          setFocusedIndex(messages.length - 1);
          if (inspectId) setInspectId(messages[messages.length - 1]?.id ?? null);
          return;
        case "Enter":
          if (focusedMessage) {
            e.preventDefault();
            setInspectId(focusedMessage.id);
            setMutedCategoryId(null);
          }
          return;
      }

      if (!focusedMessage) return;

      // C → inspect + composer focused (the brief says "Enter / C → Inspect + comment focused").
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        setInspectId(focusedMessage.id);
        setMutedCategoryId(null);
        return;
      }
      if (e.key === "t" || e.key === "T") {
        if (focusedMessage.role !== "agent") return;
        e.preventDefault();
        setPicker({
          kind: "category",
          messageId: focusedMessage.id,
          target: "bubble",
        });
        return;
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        setPicker({
          kind: "reaction",
          messageId: focusedMessage.id,
          target: "message",
        });
        return;
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cheatOpen,
    picker,
    inspectId,
    focusedMessage,
    focusedIndex,
    mutedCategoryId,
    popLayer,
  ]);

  /* ---------- Outside-click closes layers (multi-Esc parity) ---------- */

  function handleBackdropClick() {
    popLayer();
  }

  /* ---------- Render ---------- */

  return (
    <div className="relative pb-20" onClick={handleBackdropClick}>
      <div
        className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ---- Left column: convo ---- */}
        <div className="min-w-0">
          <TicketHeader ticket={ticket} />
          <PromptBar
            activityOn={activityOn}
            onToggleActivity={() => setActivityOn((v) => !v)}
            onOpenCheat={() => setCheatOpen(true)}
          />

          <div
            className="mt-4 space-y-3"
            onClick={() => {
              // Click inside convo background clears inspect/mute.
              if (inspectId) {
                setInspectId(null);
                setPendingComment("");
              } else if (mutedCategoryId) {
                setMutedCategoryId(null);
              }
            }}
          >
            {messages.map((msg, i) => {
              const cits = citationsByMessage.get(msg.id) ?? [];
              const reactions = msgReactions[msg.id] ?? [];
              const isFocused = focusedIndex === i;
              const isInspected = inspectId === msg.id;
              const isDimmed =
                (mutedCitedIds !== null && !mutedCitedIds.has(msg.id)) ||
                (inspectId !== null && inspectId !== msg.id);
              const outlineHue: Hue | null =
                mutedCitedIds !== null && mutedCitedIds.has(msg.id)
                  ? CATEGORY_HUE[mutedCategoryId!]
                  : null;
              const activities = activityOn
                ? activityByMessage.get(msg.id) ?? []
                : [];
              const pickerForThis =
                picker.kind !== "none" &&
                "messageId" in picker &&
                picker.messageId === msg.id &&
                (picker.kind === "category" || picker.kind === "score" || picker.kind === "reaction") &&
                ((picker.kind === "reaction" && picker.target === "message") ||
                  (picker.kind !== "reaction" && picker.target === "bubble"))
                  ? picker
                  : null;
              return (
                <div key={msg.id}>
                  <MessageBubble
                    ref={(el) => {
                      messageRefs.current.set(msg.id, el);
                    }}
                    index={i + 1}
                    message={msg}
                    citations={cits}
                    reactions={reactions}
                    isFocused={isFocused}
                    isInspected={isInspected}
                    isDimmed={isDimmed}
                    outlineHue={outlineHue}
                    pickerForThis={pickerForThis}
                    categories={evaluation.categories}
                    commentCount={(commentsByMsg[msg.id] ?? []).length}
                    onSelect={() => {
                      setFocusedIndex(i);
                      setInspectId(msg.id);
                      setMutedCategoryId(null);
                    }}
                    onSetCategoryOpen={(open) =>
                      setPicker(
                        open
                          ? { kind: "category", messageId: msg.id, target: "bubble" }
                          : { kind: "none" },
                      )
                    }
                    onSetReactionOpen={(open) =>
                      setPicker(
                        open
                          ? { kind: "reaction", messageId: msg.id, target: "message" }
                          : { kind: "none" },
                      )
                    }
                    onPickCategory={(catId) => {
                      const cat = evaluation.categories.find((c) => c.id === catId);
                      if (!cat) return;
                      if (cat.scaleType === "binary") {
                        addCitation(msg.id, catId, 1);
                        setPicker({ kind: "none" });
                      } else {
                        addCitation(msg.id, catId, null);
                        setPicker({
                          kind: "score",
                          messageId: msg.id,
                          categoryId: catId,
                          target: "bubble",
                        });
                      }
                    }}
                    onPickScore={(score) => {
                      if (picker.kind !== "score") return;
                      setCitationScore(picker.messageId, picker.categoryId, score);
                      setPicker({ kind: "none" });
                    }}
                    onCancelPicker={() => setPicker({ kind: "none" })}
                    onToggleReaction={(emoji) => toggleMessageReaction(msg.id, emoji)}
                  />
                  {activities.map((a) => (
                    <ActivityRow key={a.id} event={a} dimmed={isDimmed} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* ---- Right column: sticky QA panel ---- */}
        <aside className="sticky top-4 self-start">
          {inspectMessage ? (
            <InspectPanel
              ticket={ticket}
              message={inspectMessage}
              messageNumber={
                messages.findIndex((m) => m.id === inspectMessage.id) + 1
              }
              citations={citationsByMessage.get(inspectMessage.id) ?? []}
              comments={commentsByMsg[inspectMessage.id] ?? []}
              reactions={msgReactions[inspectMessage.id] ?? []}
              commentReactions={commentReactions}
              pendingComment={pendingComment}
              composerRef={composerRef}
              picker={picker}
              onClose={() => {
                setInspectId(null);
                setPendingComment("");
              }}
              onPendingCommentChange={setPendingComment}
              onSubmitComment={submitComment}
              onRemoveCitation={(catId) =>
                removeCitation(inspectMessage.id, catId)
              }
              onSetScore={(catId, score) =>
                setCitationScore(inspectMessage.id, catId, score)
              }
              onOpenAddCategory={() =>
                setPicker({
                  kind: "category",
                  messageId: inspectMessage.id,
                  target: "inspect",
                })
              }
              onPickCategoryInspect={(catId) => {
                const cat = evaluation.categories.find((c) => c.id === catId);
                if (!cat) return;
                if (cat.scaleType === "binary") {
                  addCitation(inspectMessage.id, catId, 1);
                  setPicker({ kind: "none" });
                } else {
                  addCitation(inspectMessage.id, catId, null);
                  setPicker({
                    kind: "score",
                    messageId: inspectMessage.id,
                    categoryId: catId,
                    target: "inspect",
                  });
                }
              }}
              onPickScoreInspect={(score) => {
                if (picker.kind !== "score") return;
                setCitationScore(picker.messageId, picker.categoryId, score);
                setPicker({ kind: "none" });
              }}
              onCancelPicker={() => setPicker({ kind: "none" })}
              onOpenMessageReaction={() =>
                setPicker({
                  kind: "reaction",
                  messageId: inspectMessage.id,
                  target: "message",
                })
              }
              onOpenCommentReaction={(commentId) =>
                setPicker({
                  kind: "reaction",
                  messageId: inspectMessage.id,
                  target: "comment",
                  commentId,
                })
              }
              onToggleMessageReaction={(emoji) =>
                toggleMessageReaction(inspectMessage.id, emoji)
              }
              onToggleCommentReaction={(commentId, emoji) =>
                toggleCommentReaction(commentId, emoji)
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
        </aside>
      </div>

      {/* Footer contextual hint bar */}
      <FooterBar
        picker={picker}
        cheatOpen={cheatOpen}
        inspectOpen={!!inspectId}
        focusedRole={focusedMessage?.role ?? null}
      />

      {/* Floating cheat sheet (top-right) */}
      {cheatOpen && (
        <CheatPanel onClose={() => setCheatOpen(false)} />
      )}
    </div>
  );
}

/* ================================================================== */
/* Header + prompt bar                                                  */
/* ================================================================== */

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
    <div
      className="flex items-center justify-between rounded-lg border border-dashed border-border bg-card/40 px-3 py-2"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="size-4 text-primary" />
        <span>
          Click any message to inspect it. ↑↓ or J/K to navigate, ⏎ to inspect,{" "}
          <button
            type="button"
            onClick={onOpenCheat}
            className="cursor-pointer underline-offset-2 hover:underline"
          >
            <Kbd>?</Kbd> for shortcuts
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

/* ================================================================== */
/* Activity divider (Linear style)                                       */
/* ================================================================== */

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
      <span>{event.label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

/* ================================================================== */
/* Message bubble                                                        */
/* ================================================================== */

type MessageBubbleProps = {
  index: number;
  message: SampleMessage;
  citations: Citation[];
  reactions: ReactionState[];
  isFocused: boolean;
  isInspected: boolean;
  isDimmed: boolean;
  outlineHue: Hue | null;
  pickerForThis: Picker | null;
  categories: SampleCategory[];
  commentCount: number;
  onSelect: () => void;
  onSetCategoryOpen: (open: boolean) => void;
  onSetReactionOpen: (open: boolean) => void;
  onPickCategory: (catId: string) => void;
  onPickScore: (score: number) => void;
  onCancelPicker: () => void;
  onToggleReaction: (emoji: Reaction) => void;
};

function MessageBubble({
  ref,
  index,
  message,
  citations,
  reactions,
  isFocused,
  isInspected,
  isDimmed,
  outlineHue,
  pickerForThis,
  categories,
  commentCount,
  onSelect,
  onSetCategoryOpen,
  onSetReactionOpen,
  onPickCategory,
  onPickScore,
  onCancelPicker,
  onToggleReaction,
}: MessageBubbleProps & { ref?: (el: HTMLDivElement | null) => void }) {
  const isAgent = message.role === "agent";
  const isCustomer = message.role === "customer";
  const outlineStyles = outlineHue ? HUE[outlineHue] : null;
  const citedCategoryIds = new Set(citations.map((c) => c.categoryId));
  const availableCategories = categories.filter(
    (c) => !citedCategoryIds.has(c.id),
  );
  const showCategoryPicker = pickerForThis?.kind === "category";
  const showScorePicker = pickerForThis?.kind === "score";
  const showReactionPicker = pickerForThis?.kind === "reaction";
  const scorePickerCategory =
    showScorePicker && pickerForThis
      ? categories.find((c) => c.id === pickerForThis.categoryId)
      : null;

  return (
    <div
      ref={ref}
      data-msg-id={message.id}
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
        {/* Author + time + M-label */}
        <div
          className={cn(
            "flex items-center gap-2 text-sm",
            isAgent ? "justify-end" : "justify-start",
          )}
        >
          <span className="text-xs text-muted-foreground font-medium tabular-nums">
            M{index}
          </span>
          <span className="font-medium text-foreground">
            {message.authorName}
          </span>
          <span className="text-muted-foreground">
            {formatTime(message.createdAt)}
          </span>
        </div>

        {/* Bubble + toolbar */}
        <div
          className={cn(
            "relative inline-block max-w-full",
            isAgent ? "self-end" : "self-start",
          )}
        >
          {isInspected && (
            <BubbleToolbar
              isAgent={isAgent}
              isCustomer={isCustomer}
              categoryPickerOpen={showCategoryPicker}
              reactionPickerOpen={showReactionPicker}
              onSetCategoryOpen={onSetCategoryOpen}
              onSetReactionOpen={onSetReactionOpen}
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
              isInspected &&
                "ring-2 ring-primary/40 ring-offset-1 ring-offset-background shadow-md -translate-y-px",
              isFocused &&
                !isInspected &&
                "ring-2 ring-ring ring-offset-1 ring-offset-background",
              outlineStyles && cn("ring-2", outlineStyles.ring),
            )}
          >
            {message.body}
          </button>
        </div>

        {/* Citations + reactions row */}
        {(citations.length > 0 ||
          reactions.length > 0 ||
          commentCount > 0) && (
          <div
            className={cn(
              "flex flex-wrap items-center gap-1.5 pt-1",
              isAgent ? "justify-end" : "justify-start",
            )}
          >
            {citations.map((c) => (
              <CitationChip
                key={c.key}
                citation={c}
                category={categories.find((cat) => cat.id === c.categoryId)!}
                inInspect={false}
              />
            ))}
            {reactions.map((r) => (
              <ReactionChip
                key={r.emoji}
                reaction={r}
                onToggle={() => onToggleReaction(r.emoji)}
              />
            ))}
            {commentCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-sm text-muted-foreground">
                <span aria-hidden>💬</span>
                <span className="tabular-nums">{commentCount}</span>
              </span>
            )}
          </div>
        )}

        {/* Inline pickers (category 2x3 grid, score, reaction) */}
        {showCategoryPicker && (
          <div
            className={cn("pt-2", isAgent && "flex justify-end")}
            onClick={(e) => e.stopPropagation()}
          >
            <CategoryGridPicker
              categories={availableCategories}
              allCategories={categories}
              onPick={onPickCategory}
              onCancel={onCancelPicker}
            />
          </div>
        )}
        {showScorePicker && scorePickerCategory && (
          <div
            className={cn("pt-2", isAgent && "flex justify-end")}
            onClick={(e) => e.stopPropagation()}
          >
            <ScorePicker
              category={scorePickerCategory}
              onPick={onPickScore}
              onCancel={onCancelPicker}
            />
          </div>
        )}
        {showReactionPicker && (
          <div
            className={cn("pt-2", isAgent && "flex justify-end")}
            onClick={(e) => e.stopPropagation()}
          >
            <ReactionPicker
              onPick={(emoji) => {
                onToggleReaction(emoji);
                onCancelPicker();
              }}
              onCancel={onCancelPicker}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/* Bubble toolbar (above selected message) — hints UNDER buttons      */
/* ================================================================== */

function BubbleToolbar({
  isAgent,
  isCustomer,
  categoryPickerOpen,
  reactionPickerOpen,
  onSetCategoryOpen,
  onSetReactionOpen,
}: {
  isAgent: boolean;
  isCustomer: boolean;
  categoryPickerOpen: boolean;
  reactionPickerOpen: boolean;
  onSetCategoryOpen: (open: boolean) => void;
  onSetReactionOpen: (open: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "absolute -top-14 z-20 flex items-end gap-1 animate-in fade-in slide-in-from-bottom-1 duration-150",
        isAgent ? "right-2" : "left-2",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {!isCustomer && (
        <ToolbarBtn
          label="Categorize"
          shortcut="T"
          active={categoryPickerOpen}
          onClick={() => onSetCategoryOpen(!categoryPickerOpen)}
        >
          <Tag className="size-4" />
        </ToolbarBtn>
      )}
      <ToolbarBtn
        label="React"
        shortcut="R"
        active={reactionPickerOpen}
        onClick={() => onSetReactionOpen(!reactionPickerOpen)}
      >
        <Smile className="size-4" />
      </ToolbarBtn>
    </div>
  );
}

function ToolbarBtn({
  label,
  shortcut,
  active,
  onClick,
  children,
}: {
  label: string;
  shortcut: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={cn(
          "flex size-8 cursor-pointer items-center justify-center rounded-md border border-border bg-popover text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground",
          active && "border-primary bg-primary/10 text-primary",
        )}
      >
        {children}
      </button>
      <Kbd>{shortcut}</Kbd>
    </div>
  );
}

/* ================================================================== */
/* Category 2x3 grid picker (YES 3)                                     */
/* ================================================================== */

function CategoryGridPicker({
  categories,
  allCategories,
  onPick,
  onCancel,
}: {
  categories: SampleCategory[];
  allCategories: SampleCategory[];
  onPick: (catId: string) => void;
  onCancel: () => void;
}) {
  // Cells correspond to all 5 categories in canonical order so the number
  // hint stays consistent regardless of which are already cited.
  return (
    <div className="w-[22rem] rounded-lg border border-border bg-popover p-2 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-sm font-medium text-muted-foreground">
          Categorize — press 1-5 or click
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <Kbd>Esc</Kbd>
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {allCategories.map((cat, idx) => {
          const hue = HUE[CATEGORY_HUE[cat.id]];
          const Icon = CATEGORY_ICON[cat.id] ?? Tag;
          const disabled = !categories.some((c) => c.id === cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              disabled={disabled}
              onClick={() => onPick(cat.id)}
              className={cn(
                "group relative flex h-20 cursor-pointer flex-col items-start justify-between rounded-md border p-2 text-left transition-all",
                disabled
                  ? "border-dashed border-border bg-background/40 opacity-40 cursor-not-allowed"
                  : cn(
                      "border-border bg-background hover:scale-[1.02] hover:border-transparent hover:shadow-sm",
                      `hover:${hue.bgSoft}`,
                    ),
              )}
            >
              <div className="flex w-full items-start justify-between gap-2">
                <span
                  className={cn(
                    "inline-flex size-7 items-center justify-center rounded-md",
                    hue.bgSoft,
                  )}
                >
                  <Icon className={cn("size-4", hue.text)} />
                </span>
                <Kbd>{idx + 1}</Kbd>
              </div>
              <span className="text-sm font-medium leading-tight text-foreground">
                {cat.name}
              </span>
              {disabled && (
                <span className="absolute right-2 top-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  cited
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================== */
/* Score picker (1-5)                                                    */
/* ================================================================== */

function ScorePicker({
  category,
  onPick,
  onCancel,
}: {
  category: SampleCategory;
  onPick: (n: number) => void;
  onCancel: () => void;
}) {
  const hue = HUE[CATEGORY_HUE[category.id]];
  return (
    <div
      className={cn(
        "w-[22rem] rounded-lg border bg-popover p-2 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150",
        hue.borderSoft,
      )}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <span className={cn("text-sm font-medium", hue.textDark)}>
          Score {category.name} — press 1-5
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <Kbd>Esc</Kbd>
        </button>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPick(n)}
            className={cn(
              "flex h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-border bg-background transition-all hover:scale-105",
              hue.textDark,
            )}
          >
            <DotScale value={n} hue={CATEGORY_HUE[category.id]} size="md" />
            <Kbd>{n}</Kbd>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ================================================================== */
/* Reaction picker (curated 6)                                           */
/* ================================================================== */

function ReactionPicker({
  onPick,
  onCancel,
}: {
  onPick: (emoji: Reaction) => void;
  onCancel: () => void;
}) {
  return (
    <div className="w-auto rounded-lg border border-border bg-popover p-2 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-sm font-medium text-muted-foreground">
          React — press 1-6
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <Kbd>Esc</Kbd>
        </button>
      </div>
      <div className="flex items-end gap-1">
        {REACTIONS.map((emoji, idx) => (
          <div key={emoji} className="flex flex-col items-center gap-0.5">
            <button
              type="button"
              onClick={() => onPick(emoji)}
              aria-label={`React with ${emoji}`}
              className="flex size-9 cursor-pointer items-center justify-center rounded-md text-xl transition-all hover:scale-110 hover:bg-accent"
            >
              {emoji}
            </button>
            <Kbd>{idx + 1}</Kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================== */
/* Citation chip (YES 2 — dot scale, no colored circle)                 */
/* ================================================================== */

function CitationChip({
  citation,
  category,
  inInspect,
  onRemove,
  onSetScore,
}: {
  citation: Citation;
  category: SampleCategory;
  inInspect: boolean;
  onRemove?: () => void;
  onSetScore?: (n: number) => void;
}) {
  const hue = HUE[CATEGORY_HUE[category.id]];
  const isBinary = category.scaleType === "binary";
  const effectiveScore = citation.score ?? category.effectiveScore;
  const [open, setOpen] = useState(false);

  const chipContent = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border-l-2 bg-background/60 py-0.5 pl-2 pr-2 text-sm font-medium shadow-sm transition-colors",
        hue.border,
        hue.textDark,
        "hover:bg-background/95",
      )}
    >
      <span>{category.name}</span>
      {isBinary ? (
        <span
          className={cn(
            "rounded px-1 text-xs font-semibold uppercase tracking-wide",
            effectiveScore === 1
              ? cn(hue.bgSoft, hue.textDark)
              : "bg-red-lighter text-red-darker",
          )}
        >
          {effectiveScore === 1 ? "pass" : "fail"}
        </span>
      ) : (
        <DotScale value={effectiveScore} hue={CATEGORY_HUE[category.id]} size="sm" />
      )}
      {citation.aiSuggested && (
        <Sparkles className={cn("size-3 opacity-80", hue.text)} aria-label="AI suggested" />
      )}
    </span>
  );

  if (!inInspect) {
    // Non-interactive in bubble row (clicking the bubble opens inspect).
    return chipContent;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          {chipContent}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-56 p-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-1 pb-1 pt-0.5 text-sm font-medium text-muted-foreground">
          {category.name}
        </div>
        {!isBinary && (
          <div className="mb-1 rounded-md border border-border p-1.5">
            <div className="mb-1 px-0.5 text-xs text-muted-foreground">
              Change score
            </div>
            <div className="grid grid-cols-5 gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    onSetScore?.(n);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex h-8 cursor-pointer items-center justify-center rounded text-sm font-medium tabular-nums transition-all hover:scale-105",
                    n === effectiveScore
                      ? cn(hue.bg, "text-white shadow-sm")
                      : cn("border border-border bg-background", hue.textDark),
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            onRemove?.();
            setOpen(false);
          }}
          className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent"
        >
          <X className="size-3.5" />
          Remove citation
        </button>
      </PopoverContent>
    </Popover>
  );
}

/* ================================================================== */
/* Dot scale (●●●●○)                                                   */
/* ================================================================== */

function DotScale({
  value,
  hue,
  size = "sm",
}: {
  value: number;
  hue: Hue;
  size?: "sm" | "md";
}) {
  const styles = HUE[hue];
  const dim = size === "md" ? "size-2" : "size-1.5";
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Score ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={cn(
            "rounded-full",
            dim,
            n <= value ? styles.dotFill : styles.dotEmpty,
          )}
          aria-hidden
        />
      ))}
    </span>
  );
}

/* ================================================================== */
/* Reaction chip (Slack-style, on messages AND comments)               */
/* ================================================================== */

function ReactionChip({
  reaction,
  onToggle,
}: {
  reaction: ReactionState;
  onToggle: () => void;
}) {
  const youReacted = reaction.reactors.includes("You");
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className={cn(
            "inline-flex h-6 cursor-pointer items-center gap-1 rounded-full border px-1.5 text-sm transition-colors",
            youReacted
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-border bg-card hover:bg-accent",
          )}
        >
          <span aria-hidden>{reaction.emoji}</span>
          <span className="tabular-nums text-muted-foreground">
            {reaction.reactors.length}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto max-w-60 px-2.5 py-1.5 text-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-medium text-foreground">
          {reaction.reactors.slice(0, 3).join(", ")}
          {reaction.reactors.length > 3 &&
            ` and ${reaction.reactors.length - 3} more`}
        </div>
        <div className="text-muted-foreground">
          reacted with {reaction.emoji}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ================================================================== */
/* Overview panel (no inspect)                                           */
/* ================================================================== */

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
      className="max-h-[calc(100vh-2rem)] overflow-hidden rounded-xl border border-border bg-card/95 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-right-2 duration-200"
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
      <div className="overflow-y-auto p-3" style={{ maxHeight: "calc(100vh - 11rem)" }}>
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
  const hue = CATEGORY_HUE[category.id];
  const styles = HUE[hue];
  const Icon = CATEGORY_ICON[category.id] ?? Tag;
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
          <span className="flex min-w-0 items-center gap-2">
            <Icon className={cn("size-4 shrink-0", styles.text)} />
            <span
              className={cn(
                "truncate text-base font-medium",
                active ? styles.textDark : "text-foreground",
              )}
            >
              {category.name}
            </span>
          </span>
          <CategoryScore category={category} hue={hue} />
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

function CategoryScore({ category, hue }: { category: SampleCategory; hue: Hue }) {
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
  return <DotScale value={category.effectiveScore} hue={hue} size="md" />;
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

/* ================================================================== */
/* Inspect panel                                                          */
/* ================================================================== */

function InspectPanel({
  ticket,
  message,
  messageNumber,
  citations,
  comments,
  reactions,
  commentReactions,
  pendingComment,
  composerRef,
  picker,
  onClose,
  onPendingCommentChange,
  onSubmitComment,
  onRemoveCitation,
  onSetScore,
  onOpenAddCategory,
  onPickCategoryInspect,
  onPickScoreInspect,
  onCancelPicker,
  onOpenMessageReaction,
  onOpenCommentReaction,
  onToggleMessageReaction,
  onToggleCommentReaction,
}: {
  ticket: typeof sampleTicket;
  message: SampleMessage;
  messageNumber: number;
  citations: Citation[];
  comments: Comment[];
  reactions: ReactionState[];
  commentReactions: CommentReactions;
  pendingComment: string;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  picker: Picker;
  onClose: () => void;
  onPendingCommentChange: (s: string) => void;
  onSubmitComment: () => void;
  onRemoveCitation: (categoryId: string) => void;
  onSetScore: (categoryId: string, score: number) => void;
  onOpenAddCategory: () => void;
  onPickCategoryInspect: (catId: string) => void;
  onPickScoreInspect: (score: number) => void;
  onCancelPicker: () => void;
  onOpenMessageReaction: () => void;
  onOpenCommentReaction: (commentId: string) => void;
  onToggleMessageReaction: (emoji: Reaction) => void;
  onToggleCommentReaction: (commentId: string, emoji: Reaction) => void;
}) {
  const { evaluation } = ticket;
  const isCustomer = message.role === "customer";
  const availableCategories = evaluation.categories.filter(
    (c) => !citations.some((cit) => cit.categoryId === c.id),
  );

  const inspectCategoryPickerOpen =
    picker.kind === "category" && picker.target === "inspect";
  const inspectScorePickerCategory =
    picker.kind === "score" && picker.target === "inspect"
      ? evaluation.categories.find((c) => c.id === picker.categoryId)
      : null;
  const messageReactionPickerOpen =
    picker.kind === "reaction" &&
    picker.target === "message" &&
    picker.messageId === message.id;

  return (
    <div
      className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-card/95 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-right-2 duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header — back arrow + Esc hint only */}
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
        <span className="flex-1 text-sm text-muted-foreground">
          Inspecting Message {messageNumber}
        </span>
        <Kbd>Esc</Kbd>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-5 p-4">
          {/* Citations or note about customer messages */}
          {isCustomer ? (
            <section>
              <SectionHeader label="Categorization" />
              <p className="rounded-lg border border-dashed border-border bg-background/40 p-3 text-sm text-muted-foreground">
                Customer messages aren&apos;t scored — they&apos;re what the
                agent responds to. React or comment instead.
              </p>
            </section>
          ) : (
            <section>
              <SectionHeader
                label="Citations"
                hint={
                  citations.length === 0
                    ? "None yet"
                    : `${citations.length}`
                }
              />
              {citations.length > 0 && (
                <div className="space-y-1.5">
                  {citations.map((c) => {
                    const cat = evaluation.categories.find(
                      (x) => x.id === c.categoryId,
                    );
                    if (!cat) return null;
                    return (
                      <div key={c.key} className="flex">
                        <CitationChip
                          citation={c}
                          category={cat}
                          inInspect
                          onRemove={() => onRemoveCitation(c.categoryId)}
                          onSetScore={(s) => onSetScore(c.categoryId, s)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {inspectCategoryPickerOpen ? (
                <div className="mt-2">
                  <CategoryGridPicker
                    categories={availableCategories}
                    allCategories={evaluation.categories}
                    onPick={onPickCategoryInspect}
                    onCancel={onCancelPicker}
                  />
                </div>
              ) : inspectScorePickerCategory ? (
                <div className="mt-2">
                  <ScorePicker
                    category={inspectScorePickerCategory}
                    onPick={onPickScoreInspect}
                    onCancel={onCancelPicker}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onOpenAddCategory}
                  disabled={availableCategories.length === 0}
                  className={cn(
                    "mt-2 flex w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/40",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                >
                  <Plus className="size-3.5" />
                  <span>
                    {availableCategories.length === 0
                      ? "Cited under every category"
                      : "Add category"}
                  </span>
                  <span className="ml-auto">
                    <Kbd>T</Kbd>
                  </span>
                </button>
              )}
            </section>
          )}

          {/* Reactions on message */}
          <section>
            <SectionHeader
              label="Reactions"
              hint={
                reactions.length === 0
                  ? undefined
                  : `${reactions.reduce((s, r) => s + r.reactors.length, 0)}`
              }
            />
            <div className="flex flex-wrap items-center gap-1.5">
              {reactions.map((r) => (
                <ReactionChip
                  key={r.emoji}
                  reaction={r}
                  onToggle={() => onToggleMessageReaction(r.emoji)}
                />
              ))}
              {messageReactionPickerOpen ? (
                <ReactionPicker
                  onPick={(emoji) => {
                    onToggleMessageReaction(emoji);
                    onCancelPicker();
                  }}
                  onCancel={onCancelPicker}
                />
              ) : (
                <button
                  type="button"
                  onClick={onOpenMessageReaction}
                  className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-full border border-dashed border-border bg-background px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Add reaction"
                >
                  <Smile className="size-3" />
                  <Kbd>R</Kbd>
                </button>
              )}
            </div>
          </section>

          {/* Comments + composer */}
          <section>
            <SectionHeader
              label="Comments"
              hint={
                comments.length === 0
                  ? undefined
                  : `${comments.length}`
              }
            />
            {comments.length > 0 && (
              <ul className="space-y-3">
                {comments.map((c) => (
                  <CommentRow
                    key={c.id}
                    comment={c}
                    reactions={commentReactions[c.id] ?? []}
                    onOpenReactionPicker={() => onOpenCommentReaction(c.id)}
                    reactionPickerOpen={
                      picker.kind === "reaction" &&
                      picker.target === "comment" &&
                      picker.commentId === c.id
                    }
                    onPickReaction={(emoji) => {
                      onToggleCommentReaction(c.id, emoji);
                      onCancelPicker();
                    }}
                    onCancelPicker={onCancelPicker}
                    onToggleReaction={(emoji) =>
                      onToggleCommentReaction(c.id, emoji)
                    }
                  />
                ))}
              </ul>
            )}
            <CommentComposer
              ref={composerRef}
              value={pendingComment}
              onChange={onPendingCommentChange}
              onSubmit={onSubmitComment}
              autoFocus
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

function CommentRow({
  comment,
  reactions,
  reactionPickerOpen,
  onOpenReactionPicker,
  onPickReaction,
  onCancelPicker,
  onToggleReaction,
}: {
  comment: Comment;
  reactions: ReactionState[];
  reactionPickerOpen: boolean;
  onOpenReactionPicker: () => void;
  onPickReaction: (emoji: Reaction) => void;
  onCancelPicker: () => void;
  onToggleReaction: (emoji: Reaction) => void;
}) {
  return (
    <li className="flex gap-2.5 text-left">
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
          {reactions.map((r) => (
            <ReactionChip
              key={r.emoji}
              reaction={r}
              onToggle={() => onToggleReaction(r.emoji)}
            />
          ))}
          {reactionPickerOpen ? (
            <ReactionPicker onPick={onPickReaction} onCancel={onCancelPicker} />
          ) : (
            <button
              type="button"
              onClick={onOpenReactionPicker}
              aria-label="Add reaction to comment"
              className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-full border border-dashed border-border bg-background px-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Smile className="size-3" />
              <Plus className="size-3" />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function CommentComposer({
  ref,
  value,
  onChange,
  onSubmit,
  autoFocus,
}: {
  ref: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (s: string) => void;
  onSubmit: () => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="mt-3">
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Just start typing a coaching note…"
        autoFocus={autoFocus}
        className="min-h-16 resize-none text-base"
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

/* ================================================================== */
/* Footer hint bar                                                       */
/* ================================================================== */

function FooterBar({
  picker,
  cheatOpen,
  inspectOpen,
  focusedRole,
}: {
  picker: Picker;
  cheatOpen: boolean;
  inspectOpen: boolean;
  focusedRole: SampleMessage["role"] | null;
}) {
  if (cheatOpen) return null;

  let hints: { keys: string[]; label: string }[];

  if (picker.kind === "category") {
    hints = [
      { keys: ["1", "…", "5"], label: "pick category" },
      { keys: ["Esc"], label: "cancel" },
    ];
  } else if (picker.kind === "score") {
    hints = [
      { keys: ["1", "…", "5"], label: "set score" },
      { keys: ["Esc"], label: "cancel" },
    ];
  } else if (picker.kind === "reaction") {
    hints = [
      { keys: ["1", "…", "6"], label: "react" },
      { keys: ["Esc"], label: "cancel" },
    ];
  } else if (inspectOpen) {
    hints = [
      { keys: ["↑", "↓"], label: "nav" },
      { keys: ["⌘", "⏎"], label: "post" },
      { keys: ["T"], label: "categorize" },
      { keys: ["R"], label: "react" },
      { keys: ["Esc"], label: "exit" },
      { keys: ["?"], label: "more" },
    ];
  } else {
    const base = [
      { keys: ["↑", "↓"], label: "nav" },
      { keys: ["⏎"], label: "inspect" },
      { keys: ["C"], label: "comment" },
    ];
    if (focusedRole === "agent") {
      base.push({ keys: ["T"], label: "categorize" });
    }
    base.push({ keys: ["R"], label: "react" });
    base.push({ keys: ["?"], label: "more" });
    hints = base;
  }

  return (
    <div
      className="fixed bottom-3 left-1/2 z-30 -translate-x-1/2"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 rounded-full border border-border bg-popover/95 px-4 py-1.5 shadow-md backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
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

/* ================================================================== */
/* Floating cheat panel (YES — peek, not modal)                          */
/* ================================================================== */

function CheatPanel({ onClose }: { onClose: () => void }) {
  const groups: { title: string; rows: { keys: string[]; desc: string }[] }[] = [
    {
      title: "Navigate",
      rows: [
        { keys: ["↑", "↓"], desc: "Prev / next message" },
        { keys: ["J", "K"], desc: "Prev / next (vim)" },
        { keys: ["Home", "End"], desc: "First / last" },
      ],
    },
    {
      title: "Inspect",
      rows: [
        { keys: ["⏎"], desc: "Open inspect on focused" },
        { keys: ["C"], desc: "Inspect + focus composer" },
        { keys: ["Esc"], desc: "Exit inspect" },
      ],
    },
    {
      title: "Categorize / react",
      rows: [
        { keys: ["T"], desc: "Categorize (agent only)" },
        { keys: ["R"], desc: "React" },
        { keys: ["1", "…", "5"], desc: "Pick from open picker" },
      ],
    },
    {
      title: "Compose",
      rows: [
        { keys: ["⌘", "⏎"], desc: "Post comment" },
        { keys: ["Esc"], desc: "Cancel" },
      ],
    },
    {
      title: "Help",
      rows: [{ keys: ["?"], desc: "Toggle this panel" }],
    },
  ];

  return (
    <div
      className="fixed right-4 top-4 z-40 w-80 rounded-xl border border-border bg-popover/98 p-4 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-right-2 duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Keyboard className="size-4" />
          Keyboard shortcuts
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close cheat sheet"
          className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
              {g.title}
            </div>
            <ul className="space-y-1">
              {g.rows.map((r, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 text-sm text-foreground"
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
    </div>
  );
}
