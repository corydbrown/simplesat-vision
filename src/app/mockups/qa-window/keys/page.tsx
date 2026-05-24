"use client";

/**
 * Keyboard-first QA reviewer. Reaction keys are mapped to number row 1-5
 * (same as category picker). Pressing C / T / R on a focused message
 * opens an inline picker; the picker steals number-key input until Esc
 * or until the action completes. ? opens the cheat sheet.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CircleDot,
  Keyboard,
  MessageSquarePlus,
  Plus,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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

const REACTIONS = [
  { key: "heart", emoji: "❤️" },
  { key: "fire", emoji: "🔥" },
  { key: "thumb", emoji: "👍" },
  { key: "eyes", emoji: "👀" },
  { key: "sparkle", emoji: "✨" },
] as const;

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
      author: "Diego Park",
      initials: "DP",
      body: "Tighten \"within the hour\" → wall-clock time. Otherwise excellent close.",
      createdAt: "2026-05-21T09:22:00Z",
    },
  ],
};

const INITIAL_REACTIONS: Record<string, string[]> = {
  msg_3: ["fire"],
  msg_5: ["sparkle", "thumb"],
};

const ACTIVITIES: ActivityEvent[] = [
  { id: "act_1", afterMessageId: "msg_1", label: "Assigned to Marisol Tate" },
  { id: "act_3", afterMessageId: "msg_5", label: "Recovery template applied — overnight reship" },
  { id: "act_4", afterMessageId: "msg_7", label: "Discount code BLOOM-PS-15 generated" },
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

type PickerMode =
  | { kind: "none" }
  | { kind: "category"; messageId: string }
  | { kind: "score"; messageId: string; categoryId: string }
  | { kind: "reaction"; messageId: string };

export default function KeysMockupPage() {
  const ticket = sampleTicket;
  const { evaluation, messages } = ticket;

  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [mutedCategoryId, setMutedCategoryId] = useState<string | null>(null);
  const [activityOn, setActivityOn] = useState(false);
  const [citations, setCitations] = useState<Citation[]>(INITIAL_CITATIONS);
  const [commentsByMsg, setCommentsByMsg] =
    useState<Record<string, Comment[]>>(INITIAL_COMMENTS);
  const [reactionsByMsg, setReactionsByMsg] =
    useState<Record<string, string[]>>(INITIAL_REACTIONS);
  const [composingFor, setComposingFor] = useState<string | null>(null);
  const [pendingComment, setPendingComment] = useState("");
  const [picker, setPicker] = useState<PickerMode>({ kind: "none" });
  const [cheatOpen, setCheatOpen] = useState(false);

  // Inspect-mode sidebar nav state
  const [inspectFocus, setInspectFocus] = useState<number>(0);

  const composerRef = useRef<HTMLTextAreaElement | null>(null);

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

  // Scroll focused into view smoothly
  useEffect(() => {
    if (!focusedMessage) return;
    const el = document.querySelector<HTMLElement>(
      `[data-msg-id="${focusedMessage.id}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusedMessage]);

  // Focus the composer textarea when it opens
  useEffect(() => {
    if (composingFor) {
      composerRef.current?.focus();
    }
  }, [composingFor]);

  const moveFocus = useCallback(
    (delta: number) => {
      setFocusedIndex((i) =>
        Math.min(messages.length - 1, Math.max(0, i + delta)),
      );
    },
    [messages.length],
  );

  const closeAllPickers = useCallback(() => {
    setPicker({ kind: "none" });
    setComposingFor(null);
    setPendingComment("");
  }, []);

  function addCitation(messageId: string, categoryId: string) {
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
    if (!composingFor || !pendingComment.trim()) return;
    const next: Comment = {
      id: `c_${Date.now()}`,
      author: "You",
      initials: "YO",
      body: pendingComment.trim(),
      createdAt: new Date().toISOString(),
    };
    setCommentsByMsg((prev) => ({
      ...prev,
      [composingFor]: [...(prev[composingFor] ?? []), next],
    }));
    setPendingComment("");
    setComposingFor(null);
  }

  function toggleReaction(messageId: string, key: string) {
    setReactionsByMsg((prev) => {
      const list = prev[messageId] ?? [];
      const next = list.includes(key)
        ? list.filter((k) => k !== key)
        : [...list, key];
      return { ...prev, [messageId]: next };
    });
  }

  // Global keyboard handler
  useEffect(() => {
    function handler(e: globalThis.KeyboardEvent) {
      // Skip when typing in an input/textarea (Esc and Cmd+Enter handled there)
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "TEXTAREA" || target.tagName === "INPUT";

      // ? cheat sheet — works anywhere
      if (e.key === "?" && !isTyping) {
        e.preventDefault();
        setCheatOpen((v) => !v);
        return;
      }

      if (cheatOpen) {
        // Let dialog handle its own Esc; suppress others.
        return;
      }

      if (isTyping) {
        // Esc cancels composer
        if (e.key === "Escape" && composingFor) {
          e.preventDefault();
          setComposingFor(null);
          setPendingComment("");
        }
        return;
      }

      // Picker handlers (intercept numbers + Esc)
      if (picker.kind === "category") {
        if (e.key === "Escape") {
          e.preventDefault();
          setPicker({ kind: "none" });
          return;
        }
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= evaluation.categories.length) {
          e.preventDefault();
          const cat = evaluation.categories[n - 1];
          addCitation(picker.messageId, cat.id);
          if (cat.scaleType === "binary") {
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
      }

      if (picker.kind === "score") {
        if (e.key === "Escape") {
          e.preventDefault();
          setPicker({ kind: "none" });
          return;
        }
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= 5) {
          e.preventDefault();
          setCitationScore(picker.messageId, picker.categoryId, n);
          setPicker({ kind: "none" });
          return;
        }
      }

      if (picker.kind === "reaction") {
        if (e.key === "Escape") {
          e.preventDefault();
          setPicker({ kind: "none" });
          return;
        }
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= REACTIONS.length) {
          e.preventDefault();
          toggleReaction(picker.messageId, REACTIONS[n - 1].key);
          setPicker({ kind: "none" });
          return;
        }
      }

      // Inspect-mode-only: Esc exits Inspect
      if (inspectId && e.key === "Escape") {
        e.preventDefault();
        setInspectId(null);
        return;
      }

      // Navigation
      switch (e.key) {
        case "ArrowDown":
        case "j":
        case "J":
          e.preventDefault();
          moveFocus(1);
          if (inspectId) setInspectFocus(0);
          return;
        case "ArrowUp":
        case "k":
        case "K":
          e.preventDefault();
          moveFocus(-1);
          if (inspectId) setInspectFocus(0);
          return;
        case "Home":
          e.preventDefault();
          setFocusedIndex(0);
          return;
        case "End":
          e.preventDefault();
          setFocusedIndex(messages.length - 1);
          return;
        case "PageDown":
          e.preventDefault();
          moveFocus(5);
          return;
        case "PageUp":
          e.preventDefault();
          moveFocus(-5);
          return;
        case "Enter":
          if (focusedMessage) {
            e.preventDefault();
            if (inspectId === focusedMessage.id) {
              setInspectId(null);
            } else {
              setInspectId(focusedMessage.id);
              setMutedCategoryId(null);
              setInspectFocus(0);
            }
          }
          return;
      }

      // Action shortcuts on focused message
      if (!focusedMessage) return;

      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        closeAllPickers();
        setComposingFor(focusedMessage.id);
        return;
      }
      if (e.key === "t" || e.key === "T") {
        // Customer messages cannot be categorized in this variant
        if (focusedMessage.role !== "agent") return;
        e.preventDefault();
        closeAllPickers();
        setPicker({ kind: "category", messageId: focusedMessage.id });
        return;
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        closeAllPickers();
        setPicker({ kind: "reaction", messageId: focusedMessage.id });
        return;
      }
    }

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [
    picker,
    composingFor,
    focusedMessage,
    inspectId,
    cheatOpen,
    evaluation.categories,
    messages.length,
    closeAllPickers,
    moveFocus,
  ]);

  const footerHints = useMemo(() => {
    if (cheatOpen) return null;
    if (composingFor) {
      return [
        { keys: ["⌘", "↵"], label: "post" },
        { keys: ["Esc"], label: "cancel" },
      ];
    }
    if (picker.kind === "category") {
      return [
        { keys: ["1", "…", "5"], label: "pick category" },
        { keys: ["Esc"], label: "cancel" },
      ];
    }
    if (picker.kind === "score") {
      return [
        { keys: ["1", "…", "5"], label: "set score" },
        { keys: ["Esc"], label: "cancel" },
      ];
    }
    if (picker.kind === "reaction") {
      return [
        { keys: ["1", "…", "5"], label: "react" },
        { keys: ["Esc"], label: "cancel" },
      ];
    }
    if (inspectId) {
      return [
        { keys: ["↑", "↓"], label: "nav" },
        { keys: ["Esc"], label: "exit inspect" },
        { keys: ["C"], label: "comment" },
        { keys: ["R"], label: "react" },
        { keys: ["?"], label: "more" },
      ];
    }
    const baseHints = [
      { keys: ["↑", "↓"], label: "nav" },
      { keys: ["↵"], label: "inspect" },
      { keys: ["C"], label: "comment" },
    ];
    if (focusedMessage?.role === "agent") {
      baseHints.push({ keys: ["T"], label: "categorize" });
    }
    baseHints.push({ keys: ["R"], label: "react" });
    baseHints.push({ keys: ["?"], label: "more" });
    return baseHints;
  }, [cheatOpen, composingFor, picker, inspectId, focusedMessage]);

  return (
    <div className="relative pb-14">
      <div
        className={cn(
          "transition-[padding] duration-300",
          inspectMessage ? "pr-[400px]" : "pr-0",
        )}
      >
        <TicketHeader ticket={ticket} />
        <PromptBar
          activityOn={activityOn}
          onToggleActivity={() => setActivityOn((v) => !v)}
          onOpenCheat={() => setCheatOpen(true)}
        />

        <div className="mt-4 space-y-3">
          {messages.map((msg, i) => {
            const cits = citationsByMessage.get(msg.id) ?? [];
            const reactions = reactionsByMsg[msg.id] ?? [];
            const isFocused = focusedIndex === i;
            const isInspected = inspectId === msg.id;
            const isDimmed =
              (mutedCitedIds !== null && !mutedCitedIds.has(msg.id)) ||
              (inspectId !== null && inspectId !== msg.id);
            const activities = activityOn
              ? activityByMessage.get(msg.id) ?? []
              : [];
            return (
              <div key={msg.id}>
                <MessageBubble
                  message={msg}
                  citations={cits}
                  reactions={reactions}
                  isFocused={isFocused}
                  isInspected={isInspected}
                  isDimmed={isDimmed}
                  pickerForThis={
                    picker.kind !== "none" && picker.messageId === msg.id
                      ? picker
                      : null
                  }
                  composing={composingFor === msg.id}
                  pendingComment={pendingComment}
                  comments={commentsByMsg[msg.id] ?? []}
                  categories={evaluation.categories}
                  onClick={() => {
                    setFocusedIndex(i);
                    setInspectId(msg.id);
                    setMutedCategoryId(null);
                  }}
                  onPickCategory={(catId) => {
                    addCitation(msg.id, catId);
                    const cat = evaluation.categories.find(
                      (c) => c.id === catId,
                    );
                    if (cat && cat.scaleType !== "binary") {
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
                  onPickReaction={(key) => {
                    toggleReaction(msg.id, key);
                    setPicker({ kind: "none" });
                  }}
                  onCancelPicker={() => setPicker({ kind: "none" })}
                  onPendingCommentChange={setPendingComment}
                  onSubmitComment={submitComment}
                  onCancelComment={() => {
                    setComposingFor(null);
                    setPendingComment("");
                  }}
                  composerRef={composerRef}
                  onRemoveReaction={(key) => toggleReaction(msg.id, key)}
                />
                {activities.map((a) => (
                  <ActivityRow key={a.id} event={a} />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <aside className="absolute right-0 top-0 z-20 w-[380px]">
        <div className="sticky top-4">
          {inspectMessage ? (
            <InspectPanel
              ticket={ticket}
              message={inspectMessage}
              citations={citationsByMessage.get(inspectMessage.id) ?? []}
              comments={commentsByMsg[inspectMessage.id] ?? []}
              reactions={reactionsByMsg[inspectMessage.id] ?? []}
              focusIndex={inspectFocus}
              onSetFocusIndex={setInspectFocus}
              onJumpCategory={(id) => {
                setInspectId(null);
                setMutedCategoryId(id);
              }}
              onRemoveCitation={removeCitation}
              onSetScore={setCitationScore}
              onAddCitation={(catId) => addCitation(inspectMessage.id, catId)}
              onClose={() => setInspectId(null)}
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
  );
}

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
        <Keyboard className="size-4 text-primary" />
        <span>
          Drive the whole review with the keyboard. Press{" "}
          <button
            type="button"
            onClick={onOpenCheat}
            className="cursor-pointer underline-offset-2 hover:underline"
          >
            <Kbd>?</Kbd> for the cheat sheet
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

function ActivityRow({ event }: { event: ActivityEvent }) {
  return (
    <div className="flex items-center gap-3 py-1.5 text-sm text-muted-foreground animate-in fade-in duration-200">
      <div className="h-px flex-1 bg-border" />
      <div className="flex items-center gap-1.5">
        <CircleDot className="size-3" />
        <span>{event.label}</span>
      </div>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function MessageBubble({
  message,
  citations,
  reactions,
  comments,
  isFocused,
  isInspected,
  isDimmed,
  pickerForThis,
  composing,
  pendingComment,
  categories,
  onClick,
  onPickCategory,
  onPickScore,
  onPickReaction,
  onCancelPicker,
  onPendingCommentChange,
  onSubmitComment,
  onCancelComment,
  composerRef,
  onRemoveReaction,
}: {
  message: SampleMessage;
  citations: Citation[];
  reactions: string[];
  comments: Comment[];
  isFocused: boolean;
  isInspected: boolean;
  isDimmed: boolean;
  pickerForThis: PickerMode | null;
  composing: boolean;
  pendingComment: string;
  categories: SampleCategory[];
  onClick: () => void;
  onPickCategory: (catId: string) => void;
  onPickScore: (score: number) => void;
  onPickReaction: (key: string) => void;
  onCancelPicker: () => void;
  onPendingCommentChange: (s: string) => void;
  onSubmitComment: () => void;
  onCancelComment: () => void;
  composerRef: React.RefObject<HTMLTextAreaElement | null>;
  onRemoveReaction: (key: string) => void;
}) {
  const isAgent = message.role === "agent";

  return (
    <div
      className={cn(
        "flex gap-3 transition-all duration-300 ease-out",
        isAgent ? "flex-row-reverse" : "flex-row",
        isDimmed && "opacity-30 blur-[0.5px]",
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
          <span className="font-medium text-foreground">
            {message.authorName}
          </span>
          <span className="text-muted-foreground">
            {formatTime(message.createdAt)}
          </span>
        </div>

        <div
          className={cn(
            "relative inline-block",
            isAgent ? "self-end" : "self-start",
          )}
        >
          {/* Inline shortcut hints — only on the focused bubble */}
          {isFocused && !pickerForThis && !composing && (
            <div
              className={cn(
                "absolute -top-7 z-10 flex items-center gap-1 whitespace-nowrap rounded-md border border-border bg-popover px-1.5 py-1 shadow-sm animate-in fade-in slide-in-from-bottom-1 duration-150",
                isAgent ? "right-0" : "left-0",
              )}
            >
              <HintKey k="↵" label="inspect" />
              <HintKey k="C" label="comment" />
              {isAgent && <HintKey k="T" label="categorize" />}
              <HintKey k="R" label="react" />
            </div>
          )}

          <button
            type="button"
            data-msg-id={message.id}
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className={cn(
              "relative inline-block max-w-full cursor-pointer rounded-2xl border px-4 py-3 text-left text-base transition-all duration-200 ease-out",
              isAgent
                ? "rounded-tr-sm border-primary/20 bg-primary/10 text-foreground"
                : "rounded-tl-sm border-border bg-card text-foreground",
              "hover:-translate-y-px hover:shadow-md",
              isFocused &&
                "ring-2 ring-ring ring-offset-2 ring-offset-background -translate-y-px shadow-md",
              isInspected && "ring-2 ring-primary",
            )}
          >
            {message.body}
          </button>
        </div>

        {/* Citations */}
        {citations.length > 0 && (
          <div
            className={cn(
              "flex flex-wrap gap-1.5 pt-1",
              isAgent ? "justify-end" : "justify-start",
            )}
          >
            {citations.map((c) => (
              <CategoryTab key={c.key} citation={c} />
            ))}
          </div>
        )}

        {/* Inline picker — category, score, or reaction */}
        {pickerForThis && (
          <div className={cn("pt-1.5", isAgent ? "flex justify-end" : "")}>
            {pickerForThis.kind === "category" && (
              <CategoryPickerInline
                categories={categories.filter(
                  (c) => !citations.some((ct) => ct.categoryId === c.id),
                )}
                onPick={onPickCategory}
                onCancel={onCancelPicker}
              />
            )}
            {pickerForThis.kind === "score" && (
              <ScorePickerInline
                category={
                  categories.find(
                    (c) => c.id === pickerForThis.categoryId,
                  ) ?? null
                }
                onPick={onPickScore}
                onCancel={onCancelPicker}
              />
            )}
            {pickerForThis.kind === "reaction" && (
              <ReactionPickerInline
                active={reactions}
                onPick={onPickReaction}
                onCancel={onCancelPicker}
              />
            )}
          </div>
        )}

        {/* Reactions row (always visible if any) */}
        {reactions.length > 0 && (
          <div
            className={cn(
              "flex flex-wrap gap-1 pt-1",
              isAgent ? "justify-end" : "justify-start",
            )}
          >
            {reactions.map((rk) => {
              const r = REACTIONS.find((x) => x.key === rk);
              if (!r) return null;
              return (
                <button
                  key={rk}
                  type="button"
                  onClick={() => onRemoveReaction(rk)}
                  className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-full border border-border bg-card px-1.5 text-sm text-foreground transition-colors hover:bg-accent"
                  aria-label={`Remove ${rk} reaction`}
                >
                  <span aria-hidden>{r.emoji}</span>
                  <span className="tabular-nums">1</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Comments */}
        {comments.length > 0 && (
          <div
            className={cn(
              "flex flex-col gap-1.5 pt-2",
              isAgent ? "items-end" : "items-start",
            )}
          >
            {comments.map((c) => (
              <CommentBubble
                key={c.id}
                comment={c}
                align={isAgent ? "right" : "left"}
              />
            ))}
          </div>
        )}

        {/* Comment composer */}
        {composing && (
          <div
            className={cn(
              "pt-1.5",
              isAgent ? "flex justify-end" : "",
            )}
          >
            <CommentComposerInline
              value={pendingComment}
              onChange={onPendingCommentChange}
              onSubmit={onSubmitComment}
              onCancel={onCancelComment}
              composerRef={composerRef}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function HintKey({ k, label }: { k: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Kbd>{k}</Kbd>
      <span>{label}</span>
    </span>
  );
}

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
          Categorize — press 1–5
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Esc
        </button>
      </div>
      <ul className="space-y-1">
        {categories.length === 0 && (
          <li className="px-1 py-1.5 text-sm text-muted-foreground">
            Cited under every category.
          </li>
        )}
        {categories.map((cat, idx) => {
          const hue = CATEGORY_HUE[cat.id];
          const styles = HUE[hue];
          return (
            <li key={cat.id}>
              <button
                type="button"
                onClick={() => onPick(cat.id)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:bg-accent/50"
              >
                <Kbd>{idx + 1}</Kbd>
                <span
                  className={cn("size-2 shrink-0 rounded-full", styles.bg)}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-base text-foreground">
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
  const hue = CATEGORY_HUE[category.id];
  const styles = HUE[hue];
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
            <Star
              className={cn(
                "size-4",
                styles.text,
                n <= category.effectiveScore && "fill-current",
              )}
            />
            <Kbd>{n}</Kbd>
          </button>
        ))}
      </div>
    </div>
  );
}

function ReactionPickerInline({
  active,
  onPick,
  onCancel,
}: {
  active: string[];
  onPick: (key: string) => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-popover p-2 shadow-md animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-sm font-medium text-muted-foreground">
          React — press 1–5
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Esc
        </button>
      </div>
      <div className="flex items-center gap-1 px-1 pt-1">
        {REACTIONS.map((r, idx) => {
          const isActive = active.includes(r.key);
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => onPick(r.key)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-md border px-2 py-1.5 transition-all hover:scale-105 cursor-pointer",
                isActive
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background",
              )}
              aria-label={`React with ${r.key}`}
            >
              <span className="text-base" aria-hidden>
                {r.emoji}
              </span>
              <Kbd>{idx + 1}</Kbd>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CommentBubble({
  comment,
  align,
}: {
  comment: Comment;
  align: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "flex max-w-[90%] items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2",
        align === "right" && "flex-row-reverse text-right",
      )}
    >
      <div
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary"
        aria-hidden
      >
        {comment.initials}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "flex items-baseline gap-2 text-sm",
            align === "right" && "justify-end",
          )}
        >
          <span className="font-medium text-foreground">{comment.author}</span>
          <span className="text-muted-foreground">
            {formatRelative(comment.createdAt)}
          </span>
        </div>
        <div className="text-base text-foreground">{comment.body}</div>
      </div>
    </div>
  );
}

function CommentComposerInline({
  value,
  onChange,
  onSubmit,
  onCancel,
  composerRef,
}: {
  value: string;
  onChange: (s: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  composerRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <div className="w-[28rem] max-w-full rounded-lg border border-primary/30 bg-card p-2 shadow-sm animate-in fade-in slide-in-from-top-1 duration-150">
      <Textarea
        ref={composerRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your coaching note…"
        className="min-h-16 resize-none text-base"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      <div className="mt-1.5 flex items-center justify-between text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <Kbd>⌘</Kbd>
            <Kbd>↵</Kbd>
            <span>post</span>
          </span>
          <span aria-hidden>·</span>
          <span className="flex items-center gap-1">
            <Kbd>Esc</Kbd>
            <span>cancel</span>
          </span>
        </span>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!value.trim()}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground transition-opacity",
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

/* -------------------- Overview / Inspect panels -------------------- */

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

function InspectPanel({
  ticket,
  message,
  citations,
  comments,
  reactions,
  focusIndex,
  onSetFocusIndex,
  onJumpCategory,
  onRemoveCitation,
  onSetScore,
  onAddCitation,
  onClose,
}: {
  ticket: typeof sampleTicket;
  message: SampleMessage;
  citations: Citation[];
  comments: Comment[];
  reactions: string[];
  focusIndex: number;
  onSetFocusIndex: (n: number) => void;
  onJumpCategory: (id: string) => void;
  onRemoveCitation: (messageId: string, categoryId: string) => void;
  onSetScore: (messageId: string, categoryId: string, score: number) => void;
  onAddCitation: (catId: string) => void;
  onClose: () => void;
}) {
  const { evaluation } = ticket;
  const isAgent = message.role === "agent";
  const availableCategories = evaluation.categories.filter(
    (c) => !citations.some((cit) => cit.categoryId === c.id),
  );
  const [addingCategory, setAddingCategory] = useState(false);

  // Sidebar items in flat list for arrow nav (citations first, then comments, then reactions)
  const sidebarItems = useMemo(
    () => [
      ...citations.map((c) => ({ kind: "cit" as const, key: c.key, c })),
      ...comments.map((c) => ({ kind: "cmt" as const, key: c.id, c })),
      ...reactions.map((r) => ({ kind: "rxn" as const, key: r, r })),
    ],
    [citations, comments, reactions],
  );

  const safeFocus = Math.min(focusIndex, Math.max(0, sidebarItems.length - 1));

  return (
    <div className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-card/95 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-right-2 duration-200">
      <div className="flex items-center justify-between border-b border-border bg-background/40 px-3 py-2">
        <button
          type="button"
          onClick={onClose}
          className="flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Exit Inspect"
        >
          <X className="size-3.5" />
          <span>Inspect</span>
          <Kbd>Esc</Kbd>
        </button>
        <span className="text-sm text-muted-foreground">
          {sidebarItems.length} {sidebarItems.length === 1 ? "item" : "items"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          <section>
            <SectionHeader label="Selected message" />
            <div
              className={cn(
                "rounded-lg border p-3",
                isAgent
                  ? "border-primary/20 bg-primary/10"
                  : "border-border bg-background",
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-foreground">
                  {message.authorName}
                </span>
                <span className="text-muted-foreground">
                  {formatTime(message.createdAt)}
                  <span className="ml-1 capitalize">· {message.role}</span>
                </span>
              </div>
              <p className="text-base text-foreground">{message.body}</p>
            </div>
          </section>

          <section>
            <SectionHeader
              label="Citations"
              hint={
                citations.length === 0
                  ? "Not cited yet."
                  : `${citations.length}`
              }
            />
            <div className="space-y-1.5">
              {citations.map((c, idx) => {
                const cat = evaluation.categories.find(
                  (x) => x.id === c.categoryId,
                );
                if (!cat) return null;
                const effectiveScore = c.score ?? cat.effectiveScore;
                const isFocused =
                  sidebarItems[safeFocus]?.kind === "cit" &&
                  sidebarItems[safeFocus]?.key === c.key;
                return (
                  <CitationRow
                    key={c.key}
                    citation={c}
                    category={cat}
                    effectiveScore={effectiveScore}
                    isFocused={isFocused}
                    onFocus={() => onSetFocusIndex(idx)}
                    onJump={() => onJumpCategory(c.categoryId)}
                    onSetScore={(s) => onSetScore(message.id, c.categoryId, s)}
                    onRemove={() =>
                      onRemoveCitation(message.id, c.categoryId)
                    }
                  />
                );
              })}

              {addingCategory ? (
                <div className="rounded-lg border border-dashed border-border bg-background/40 p-2">
                  <div className="mb-1 flex items-center justify-between px-1 text-sm text-muted-foreground">
                    <span>Pick a category</span>
                    <button
                      type="button"
                      onClick={() => setAddingCategory(false)}
                      className="cursor-pointer transition-colors hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                  <ul className="space-y-0.5">
                    {availableCategories.map((cat) => {
                      const hue = CATEGORY_HUE[cat.id];
                      const styles = HUE[hue];
                      return (
                        <li key={cat.id}>
                          <button
                            type="button"
                            onClick={() => {
                              onAddCitation(cat.id);
                              setAddingCategory(false);
                            }}
                            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent/50"
                          >
                            <span
                              className={cn(
                                "size-2 rounded-full",
                                styles.bg,
                              )}
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
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingCategory(true)}
                  disabled={availableCategories.length === 0}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/40",
                    "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
                  )}
                >
                  <Plus className="size-3.5" />
                  {availableCategories.length === 0
                    ? "Cited under every category"
                    : "Add to category…"}{" "}
                  <span className="ml-auto flex items-center gap-1">
                    <Kbd>T</Kbd>
                  </span>
                </button>
              )}
            </div>
          </section>

          <section>
            <SectionHeader
              label="Comments"
              hint={comments.length === 0 ? undefined : `${comments.length}`}
            />
            {comments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-background/40 p-3 text-sm text-muted-foreground">
                Press <Kbd>C</Kbd> to add a coaching note.
              </div>
            ) : (
              <ul className="space-y-2.5">
                {comments.map((c) => (
                  <li key={c.id} className="flex gap-2.5">
                    <div
                      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground"
                      aria-hidden
                    >
                      {c.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 text-sm">
                        <span className="font-medium text-foreground">
                          {c.author}
                        </span>
                        <span className="text-muted-foreground">
                          {formatRelative(c.createdAt)}
                        </span>
                      </div>
                      <p className="text-base text-foreground">{c.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {reactions.length > 0 && (
            <section>
              <SectionHeader label="Reactions" hint={`${reactions.length}`} />
              <div className="flex flex-wrap gap-1.5">
                {reactions.map((rk) => {
                  const r = REACTIONS.find((x) => x.key === rk);
                  if (!r) return null;
                  return (
                    <span
                      key={rk}
                      className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-background px-2 text-sm text-foreground"
                    >
                      <span aria-hidden>{r.emoji}</span>
                      <span className="text-muted-foreground">{rk}</span>
                    </span>
                  );
                })}
              </div>
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
  isFocused,
  onFocus,
  onJump,
  onSetScore,
  onRemove,
}: {
  citation: Citation;
  category: SampleCategory;
  effectiveScore: number;
  isFocused: boolean;
  onFocus: () => void;
  onJump: () => void;
  onSetScore: (s: number) => void;
  onRemove: () => void;
}) {
  const [changingScore, setChangingScore] = useState(false);
  const hue = CATEGORY_HUE[category.id];
  const styles = HUE[hue];
  const isBinary = category.scaleType === "binary";

  return (
    <div
      onMouseEnter={onFocus}
      className={cn(
        "rounded-lg border px-3 py-2 transition-all",
        styles.borderSoft,
        styles.bgSoft,
        isFocused && "ring-2 ring-ring ring-offset-1 ring-offset-background",
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onJump}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
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
        </button>
        {citation.aiSuggested && (
          <Sparkles
            className={cn("size-3 shrink-0 opacity-80", styles.text)}
            aria-label="AI suggested"
          />
        )}
        {!isBinary && (
          <button
            type="button"
            onClick={() => setChangingScore((v) => !v)}
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
      {changingScore && !isBinary && (
        <div className="mt-2 flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-150">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                onSetScore(n);
                setChangingScore(false);
              }}
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

/* -------------------- Footer + cheat sheet -------------------- */

function FooterBar({
  hints,
}: {
  hints: { keys: string[]; label: string }[] | null;
}) {
  if (!hints) return null;
  return (
    <div className="fixed bottom-3 left-1/2 z-30 -translate-x-1/2">
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

function CheatSheet() {
  const groups: { title: string; rows: { keys: string[]; desc: string }[] }[] = [
    {
      title: "Navigate",
      rows: [
        { keys: ["↑"], desc: "Previous message" },
        { keys: ["↓"], desc: "Next message" },
        { keys: ["J"], desc: "Next (vim)" },
        { keys: ["K"], desc: "Previous (vim)" },
        { keys: ["Home"], desc: "Jump to first" },
        { keys: ["End"], desc: "Jump to last" },
        { keys: ["PgUp"], desc: "Up 5" },
        { keys: ["PgDn"], desc: "Down 5" },
      ],
    },
    {
      title: "Inspect mode",
      rows: [
        { keys: ["↵"], desc: "Open Inspect on focused message" },
        { keys: ["Esc"], desc: "Exit Inspect" },
      ],
    },
    {
      title: "Coach",
      rows: [
        { keys: ["C"], desc: "Comment on focused message" },
        { keys: ["T"], desc: "Categorize (agent messages only)" },
        { keys: ["R"], desc: "React" },
      ],
    },
    {
      title: "Pickers — numbers 1-5",
      rows: [
        { keys: ["1", "…", "5"], desc: "Pick category / score / reaction" },
        { keys: ["Esc"], desc: "Cancel picker" },
      ],
    },
    {
      title: "Compose",
      rows: [
        { keys: ["⌘", "↵"], desc: "Post comment" },
        { keys: ["Esc"], desc: "Cancel comment" },
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
