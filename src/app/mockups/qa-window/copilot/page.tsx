"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  HelpCircle,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Kbd } from "@/components/ui/kbd";
import {
  sampleTicket,
  type SampleCategory,
  type SampleMessage,
} from "@/lib/mockups/sample-data";
import { cn } from "@/lib/utils";

/* -------------------- Hues -------------------- */

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
  aiSuggested?: boolean;
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

const INITIAL_COMMENT_REACTIONS: Record<string, Partial<Record<Reaction, number>>> = {
  c1: { "👍": 2 },
  c3: { "❤️": 1 },
};

/* -------------------- AI chat seed -------------------- */

type ChatBlock =
  | { kind: "text"; body: string }
  | { kind: "ref"; messageId: string; label: string };

type ChatMessage = {
  id: string;
  role: "user" | "ai";
  /** Mixed inline content: text segments + message refs. */
  blocks: ChatBlock[];
  /** Optional suggestion card attached to an AI reply. */
  suggestion?: {
    targetMessageId: string;
    body: string;
  };
};

const INITIAL_CHAT: ChatMessage[] = [
  {
    id: "ch_1",
    role: "user",
    blocks: [
      { kind: "text", body: "Why did you give Acknowledge & empathize a 4 instead of a 5?" },
    ],
  },
  {
    id: "ch_2",
    role: "ai",
    blocks: [
      {
        kind: "text",
        body: "The apology in ",
      },
      { kind: "ref", messageId: "msg_3", label: "Message 3" },
      {
        kind: "text",
        body:
          " is sincere — \"so sorry, that's frustrating with an event coming up\" — but it comes after the diagnosis. A 5 would lead with the empathy before explaining the carrier-vs-fulfillment split. Same words, opposite order.",
      },
    ],
  },
  {
    id: "ch_3",
    role: "user",
    blocks: [
      { kind: "text", body: "What should Marisol have done differently in Message 5?" },
    ],
  },
  {
    id: "ch_4",
    role: "ai",
    blocks: [
      {
        kind: "text",
        body:
          "Honestly, ",
      },
      { kind: "ref", messageId: "msg_5", label: "Message 5" },
      {
        kind: "text",
        body:
          " is already strong — two concrete options tied to Saturday is the template. The one nit: name the carrier and a wall-clock ETA for option 1 (\"FedEx Priority Overnight, delivered by 10:30am Friday\"), not just \"Thursday or Friday at the latest.\" Anxiety drops when the deadline is specific.",
      },
    ],
    suggestion: {
      targetMessageId: "msg_5",
      body:
        "Strong options framing. Next time, name the carrier + wall-clock ETA on the reship (\"FedEx Priority Overnight, by 10:30am Friday\") instead of \"Thursday or Friday at the latest\" — specificity calms the deadline anxiety.",
    },
  },
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

/** Friendly "Message N" reference for a message id (msg_5 → "Message 5"). */
function messageLabel(messages: SampleMessage[], id: string): string {
  const idx = messages.findIndex((m) => m.id === id);
  if (idx < 0) return id;
  return `Message ${idx + 1}`;
}

export default function CopilotMockupPage() {
  const ticket = sampleTicket;
  const { evaluation, messages } = ticket;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [mutedCategoryId, setMutedCategoryId] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>(INITIAL_CITATIONS);
  const [commentsByMsg, setCommentsByMsg] =
    useState<Record<string, Comment[]>>(INITIAL_COMMENTS);
  const [reactionsByMsg, setReactionsByMsg] = useState<
    Record<string, Partial<Record<Reaction, number>>>
  >(INITIAL_REACTIONS);
  const [reactionsByComment, setReactionsByComment] = useState<
    Record<string, Partial<Record<Reaction, number>>>
  >(INITIAL_COMMENT_REACTIONS);
  const [pendingComment, setPendingComment] = useState("");
  const [changingScoreFor, setChangingScoreFor] = useState<string | null>(null);
  const [reactionStripFor, setReactionStripFor] = useState<string | null>(null);
  const [commentReactionStripFor, setCommentReactionStripFor] = useState<
    string | null
  >(null);
  const [categoryPickerFor, setCategoryPickerFor] = useState<string | null>(
    null,
  );
  const [oneClickScoreFor, setOneClickScoreFor] = useState<{
    msgId: string;
    catId: string;
  } | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(
    null,
  );
  const [cheatOpen, setCheatOpen] = useState(false);

  /* ---- Chat drawer state ---- */
  const [chatOpen, setChatOpen] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>(INITIAL_CHAT);
  const [chatDraft, setChatDraft] = useState("");
  const [discardedSuggestions, setDiscardedSuggestions] = useState<Set<string>>(
    new Set(),
  );
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<Set<string>>(
    new Set(),
  );

  const messageRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const chatThreadRef = useRef<HTMLDivElement | null>(null);

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

  const resetEphemerals = useCallback(() => {
    setChangingScoreFor(null);
    setReactionStripFor(null);
    setCommentReactionStripFor(null);
    setCategoryPickerFor(null);
    setOneClickScoreFor(null);
    setPendingComment("");
  }, []);

  const selectMessage = useCallback((id: string) => {
    setSelectedId((prev) => {
      if (prev !== id) {
        setChangingScoreFor(null);
        setPendingComment("");
      }
      return id;
    });
    setFocusedId(id);
    setMutedCategoryId(null);
    // Auto-focus the comment composer when Inspect opens.
    requestAnimationFrame(() => composerRef.current?.focus());
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedId((prev) => {
      if (prev !== null) {
        setChangingScoreFor(null);
        setReactionStripFor(null);
        setCommentReactionStripFor(null);
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

  function addCommentReaction(commentId: string, emoji: Reaction) {
    setReactionsByComment((prev) => {
      const curr = prev[commentId] ?? {};
      return {
        ...prev,
        [commentId]: { ...curr, [emoji]: (curr[emoji] ?? 0) + 1 },
      };
    });
    setCommentReactionStripFor(null);
  }

  /* ---- Highlight a message (used by chat "Message N" chips). ---- */
  const flashHighlight = useCallback((messageId: string) => {
    setHighlightedMessageId(messageId);
    const el = messageRefs.current.get(messageId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      setHighlightedMessageId((curr) => (curr === messageId ? null : curr));
    }, 1500);
  }, []);

  /* ---- Chat actions ---- */
  const openChat = useCallback(
    (opts?: { focus?: boolean; prepopulateRef?: string | null }) => {
      setChatOpen(true);
      if (opts?.prepopulateRef) {
        const label = messageLabel(messages, opts.prepopulateRef);
        setChatDraft((curr) => (curr ? curr : `Re: ${label} — `));
      }
      if (opts?.focus !== false) {
        requestAnimationFrame(() => chatInputRef.current?.focus());
      }
    },
    [messages],
  );

  const closeChat = useCallback(() => {
    setChatOpen(false);
    chatInputRef.current?.blur();
  }, []);

  function submitChat() {
    const body = chatDraft.trim();
    if (!body) return;
    const userMsg: ChatMessage = {
      id: `ch_${Date.now()}_u`,
      role: "user",
      blocks: [{ kind: "text", body }],
    };
    // Canned AI follow-up. Picks a contextual reply based on what's on screen.
    const aiReply = generateAiReply(body, selectedId, messages);
    setChat((prev) => [...prev, userMsg, aiReply]);
    setChatDraft("");
    requestAnimationFrame(() => {
      chatThreadRef.current?.scrollTo({
        top: chatThreadRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }

  function acceptSuggestion(chatId: string, targetMessageId: string, body: string) {
    const next: Comment = {
      id: `c_ai_${Date.now()}`,
      author: "You",
      initials: "YO",
      body,
      createdAt: new Date().toISOString(),
      aiSuggested: true,
    };
    setCommentsByMsg((prev) => ({
      ...prev,
      [targetMessageId]: [...(prev[targetMessageId] ?? []), next],
    }));
    setAcceptedSuggestions((prev) => new Set(prev).add(chatId));
    flashHighlight(targetMessageId);
  }

  function discardSuggestion(chatId: string) {
    setDiscardedSuggestions((prev) => new Set(prev).add(chatId));
  }

  /* ---- Keyboard ---- */

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
      const inChatInput = tgt === chatInputRef.current;

      // Cheat sheet — always wins
      if (e.key === "?" && !inEditable) {
        e.preventDefault();
        setCheatOpen((v) => !v);
        return;
      }
      if (cheatOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setCheatOpen(false);
        }
        return;
      }

      // Multi-Esc: chat-input → blur · chat-open → close drawer · inspect → exit · muted → clear
      if (e.key === "Escape") {
        if (inChatInput) {
          e.preventDefault();
          chatInputRef.current?.blur();
          return;
        }
        if (chatOpen) {
          e.preventDefault();
          closeChat();
          return;
        }
        if (inEditable) return;
        if (selectedId) {
          e.preventDefault();
          clearSelection();
          return;
        }
        if (mutedCategoryId) {
          e.preventDefault();
          setMutedCategoryId(null);
          return;
        }
        return;
      }

      // `/` opens chat panel + focuses input (anywhere, not inside an input)
      if (e.key === "/" && !inEditable) {
        e.preventDefault();
        openChat({
          focus: true,
          prepopulateRef: selectedId,
        });
        return;
      }

      if (inEditable) return;

      // Quick-action keys (require a focused message)
      if (e.key === "t" || e.key === "T") {
        if (focusedId) {
          const msg = messages.find((m) => m.id === focusedId);
          if (msg && msg.role === "agent") {
            e.preventDefault();
            selectMessage(focusedId);
            setCategoryPickerFor(focusedId);
            setReactionStripFor(null);
          }
        }
        return;
      }
      if (e.key === "r" || e.key === "R") {
        if (focusedId) {
          e.preventDefault();
          selectMessage(focusedId);
          setReactionStripFor(focusedId);
          setCategoryPickerFor(null);
        }
        return;
      }
      if (e.key === "c" || e.key === "C") {
        if (focusedId) {
          e.preventDefault();
          selectMessage(focusedId);
          requestAnimationFrame(() => composerRef.current?.focus());
        }
        return;
      }

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
  }, [
    selectedId,
    focusedId,
    mutedCategoryId,
    moveFocus,
    selectMessage,
    clearSelection,
    cheatOpen,
    chatOpen,
    openChat,
    closeChat,
    messages,
  ]);

  // Scroll focused message into view when it changes via keyboard.
  useEffect(() => {
    if (!focusedId) return;
    const el = messageRefs.current.get(focusedId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusedId]);

  // When a sidebar category is selected, auto-scroll first cited to top.
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

  // Scroll chat to bottom when drawer opens.
  useEffect(() => {
    if (!chatOpen) return;
    requestAnimationFrame(() => {
      chatThreadRef.current?.scrollTo({
        top: chatThreadRef.current.scrollHeight,
      });
    });
  }, [chatOpen]);

  const drawerExpandedPx = 360;
  const drawerCollapsedPx = 48;
  const bottomPadPx = chatOpen ? drawerExpandedPx + 16 : drawerCollapsedPx + 16;

  return (
    <div
      className="relative transition-[padding] duration-300"
      style={{ paddingBottom: `${bottomPadPx}px` }}
    >
      <div className="pr-[400px]">
        <TicketHeader ticket={ticket} />

        <div
          className="mt-4 space-y-3"
          onClick={() => {
            if (selectedId) clearSelection();
            else if (mutedCategoryId) setMutedCategoryId(null);
            resetEphemerals();
          }}
        >
          {messages.map((msg, idx) => {
            const cits = citationsByMessage.get(msg.id) ?? [];
            const isSelected = selectedId === msg.id;
            const isFocused = focusedId === msg.id && !isSelected;
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
            const isFlashing = highlightedMessageId === msg.id;
            const comments = commentsByMsg[msg.id] ?? [];
            return (
              <MessageBubble
                key={msg.id}
                ref={(el) => {
                  messageRefs.current.set(msg.id, el);
                }}
                messageNumber={idx + 1}
                message={msg}
                citations={cits}
                isSelected={isSelected}
                isFocused={isFocused}
                isDimmed={isDimmed}
                isFlashing={isFlashing}
                outlineHue={outlineHue}
                commentCount={comments.length}
                reactions={reactionsByMsg[msg.id] ?? {}}
                reactionStripOpen={reactionStripFor === msg.id}
                categoryPickerOpen={categoryPickerFor === msg.id}
                oneClickScoreFor={
                  oneClickScoreFor?.msgId === msg.id ? oneClickScoreFor : null
                }
                categories={evaluation.categories}
                onSelect={() => selectMessage(msg.id)}
                onAddComment={() => {
                  selectMessage(msg.id);
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
                messages={messages}
              />
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
              messageNumber={
                messages.findIndex((m) => m.id === selected.id) + 1
              }
              citations={citationsByMessage.get(selected.id) ?? []}
              comments={commentsByMsg[selected.id] ?? []}
              commentReactions={reactionsByComment}
              commentReactionStripFor={commentReactionStripFor}
              onSetCommentReactionsOpen={(commentId, open) =>
                setCommentReactionStripFor(open ? commentId : null)
              }
              onAddCommentReaction={addCommentReaction}
              changingScoreFor={changingScoreFor}
              pendingComment={pendingComment}
              composerRef={composerRef}
              onClose={clearSelection}
              onAskAi={() =>
                openChat({ focus: true, prepopulateRef: selected.id })
              }
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
              onAskAi={() => openChat({ focus: true })}
            />
          )}
        </div>
      </aside>

      <ChatDrawer
        open={chatOpen}
        chat={chat}
        draft={chatDraft}
        inputRef={chatInputRef}
        threadRef={chatThreadRef}
        messages={messages}
        discardedSuggestions={discardedSuggestions}
        acceptedSuggestions={acceptedSuggestions}
        bottomOffsetPx={chatOpen ? drawerExpandedPx : drawerCollapsedPx}
        onOpen={() => openChat({ focus: true })}
        onClose={closeChat}
        onChangeDraft={setChatDraft}
        onSubmit={submitChat}
        onClickMessageRef={(id) => flashHighlight(id)}
        onAcceptSuggestion={acceptSuggestion}
        onDiscardSuggestion={discardSuggestion}
      />

      <KeyboardHintBar
        chatOpen={chatOpen}
        bottomOffsetPx={chatOpen ? drawerExpandedPx + 12 : drawerCollapsedPx + 12}
      />

      <Dialog open={cheatOpen} onOpenChange={setCheatOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
          </DialogHeader>
          <CheatSheet />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------- AI reply generator (mock) -------------------- */

function generateAiReply(
  userBody: string,
  selectedId: string | null,
  messages: SampleMessage[],
): ChatMessage {
  const id = `ch_${Date.now()}_a`;
  const lower = userBody.toLowerCase();

  // "Compare to ideal" intent
  if (lower.includes("5/5") || lower.includes("ideal") || lower.includes("perfect")) {
    return {
      id,
      role: "ai",
      blocks: [
        {
          kind: "text",
          body:
            "A 5/5 on Diagnose looks like: \"Your label was created Tuesday but the package never scanned at the carrier — that's a fulfillment-side issue on our warehouse, not the carrier. I see why you're stressed about Saturday.\" Same content as ",
        },
        { kind: "ref", messageId: "msg_3", label: "Message 3" },
        {
          kind: "text",
          body: ", but it surfaces the impact statement before the technical split.",
        },
      ],
    };
  }

  // "Patterns" intent
  if (
    lower.includes("often") ||
    lower.includes("pattern") ||
    lower.includes("history") ||
    lower.includes("usually")
  ) {
    return {
      id,
      role: "ai",
      blocks: [
        {
          kind: "text",
          body:
            "Marisol's average on Diagnose is 3.6 across 18 tickets in the last 90 days — this 5 is above her trend. Where she dips is shipping issues specifically (avg 3.1); refund and product-fit tickets she handles cleanly. Worth a coaching beat if you've got the bandwidth.",
        },
      ],
    };
  }

  // "Suggest a note" intent
  if (
    lower.includes("coach") ||
    lower.includes("note") ||
    lower.includes("differently") ||
    lower.includes("better")
  ) {
    const target = selectedId ?? "msg_5";
    return {
      id,
      role: "ai",
      blocks: [
        { kind: "text", body: "Here's a note you could leave on " },
        { kind: "ref", messageId: target, label: messageLabel(messages, target) },
        {
          kind: "text",
          body:
            " — specific, evidence-backed, keeps the praise-then-stretch shape:",
        },
      ],
      suggestion: {
        targetMessageId: target,
        body:
          target === "msg_5"
            ? "Strong options framing. Next time, name the carrier + a wall-clock ETA on the reship (\"FedEx Priority Overnight, by 10:30am Friday\") instead of \"Thursday or Friday at the latest\" — specificity calms the deadline anxiety."
            : "Solid call here. One small lift: lead with the empathy beat before the diagnosis. Customers regulate faster when they hear \"I see why this is rough\" before the technical explanation.",
      },
    };
  }

  // Default: explain a score
  const target = selectedId ?? "msg_3";
  return {
    id,
    role: "ai",
    blocks: [
      { kind: "text", body: "Looking at " },
      { kind: "ref", messageId: target, label: messageLabel(messages, target) },
      {
        kind: "text",
        body:
          " — Marisol does the substantive work well but the framing could be sharper. The score reflects \"got the job done\" rather than \"set a template.\" Want me to draft a coaching note that names the specific lift?",
      },
    ],
  };
}

/* -------------------- Ticket header -------------------- */

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

/* -------------------- Message bubble -------------------- */

type MessageBubbleProps = {
  message: SampleMessage;
  messageNumber: number;
  citations: Citation[];
  isSelected: boolean;
  isFocused: boolean;
  isDimmed: boolean;
  isFlashing: boolean;
  outlineHue: Hue | null;
  commentCount: number;
  reactions: Partial<Record<Reaction, number>>;
  reactionStripOpen: boolean;
  categoryPickerOpen: boolean;
  oneClickScoreFor: { msgId: string; catId: string } | null;
  categories: SampleCategory[];
  messages: SampleMessage[];
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
  messageNumber,
  citations,
  isSelected,
  isFocused,
  isDimmed,
  isFlashing,
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
  const isCustomer = message.role === "customer";
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
          <span
            className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-muted px-1 font-mono text-xs text-muted-foreground"
            aria-label={`Message ${messageNumber}`}
          >
            {messageNumber}
          </span>
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
          {isSelected && (
            <SelectedToolbar
              isAgent={isAgent}
              isCustomer={isCustomer}
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
              isFlashing &&
                "ring-4 ring-teal/60 ring-offset-2 ring-offset-background animate-pulse",
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

/* -------------------- Floating toolbar (selected bubble) -------------------- */

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
        "absolute -top-14 z-20 flex flex-col items-stretch gap-1 animate-in fade-in slide-in-from-bottom-1 duration-150",
        isAgent ? "right-2" : "left-2",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={cn(
          "flex items-center gap-0.5 rounded-lg border border-border bg-popover p-0.5 shadow-md",
          isAgent ? "self-end" : "self-start",
        )}
      >
        <ToolbarBtn label="Add comment (C)" hint="C" onClick={onAddComment}>
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
                aria-label="Add to category (T)"
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

        <Popover open={reactionStripOpen} onOpenChange={onSetReactionsOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Add reaction (R)"
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

      {/* Hotkey hints UNDER the toolbar (not inside buttons). */}
      <div
        className={cn(
          "flex items-center gap-3 px-1 text-xs text-muted-foreground",
          isAgent ? "self-end" : "self-start",
        )}
      >
        <HintInline kbd="C" label="comment" />
        {!isCustomer && <HintInline kbd="T" label="categorize" />}
        <HintInline kbd="R" label="react" />
      </div>
    </div>
  );
}

function HintInline({ kbd, label }: { kbd: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <Kbd>{kbd}</Kbd>
      <span>{label}</span>
    </span>
  );
}

function ToolbarBtn({
  onClick,
  label,
  children,
}: {
  onClick: (e: React.MouseEvent) => void;
  label: string;
  hint?: string;
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

/* -------------------- Citation chip (under bubble) -------------------- */

function CategoryTab({ citation }: { citation: Citation }) {
  const hue = CATEGORY_HUE[citation.categoryId];
  const styles = HUE[hue];
  const category = sampleTicket.evaluation.categories.find(
    (c) => c.id === citation.categoryId,
  );
  if (!category) return null;
  const effectiveScore = citation.score ?? category.effectiveScore;
  const isBinary = category.scaleType === "binary";
  const scoreLabel = isBinary
    ? effectiveScore === 1
      ? "Pass"
      : "Fail"
    : `${effectiveScore}/5`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-sm font-medium shadow-sm",
        styles.bgSoft,
        styles.borderSoft,
        styles.textDark,
      )}
    >
      <span>{category.name}</span>
      <span className={cn("tabular-nums opacity-80")}>{scoreLabel}</span>
      {citation.aiSuggested && (
        <Sparkles className="size-3 opacity-80" aria-label="AI suggested" />
      )}
    </span>
  );
}

/* -------------------- Overview panel -------------------- */

function OverviewPanel({
  evaluation,
  mutedCategoryId,
  onToggleMute,
  onAskAi,
}: {
  evaluation: typeof sampleTicket.evaluation;
  mutedCategoryId: string | null;
  onToggleMute: (id: string) => void;
  onAskAi: () => void;
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
        <AskAiButton onClick={onAskAi} />
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

function AskAiButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-teal-light bg-teal-lighter px-2 py-1 text-sm font-medium text-teal-darker transition-colors hover:bg-teal-light"
    >
      <Sparkles className="size-3.5" />
      <span>Ask the AI</span>
    </button>
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

/* -------------------- Inspect panel -------------------- */

function InspectPanel({
  ticket,
  message,
  messageNumber,
  citations,
  comments,
  commentReactions,
  commentReactionStripFor,
  onSetCommentReactionsOpen,
  onAddCommentReaction,
  changingScoreFor,
  pendingComment,
  composerRef,
  onClose,
  onAskAi,
  onRemoveCitation,
  onSetScore,
  onStartChangingScore,
  onPendingCommentChange,
  onSubmitComment,
}: {
  ticket: typeof sampleTicket;
  message: SampleMessage;
  messageNumber: number;
  citations: Citation[];
  comments: Comment[];
  commentReactions: Record<string, Partial<Record<Reaction, number>>>;
  commentReactionStripFor: string | null;
  onSetCommentReactionsOpen: (commentId: string, open: boolean) => void;
  onAddCommentReaction: (commentId: string, emoji: Reaction) => void;
  changingScoreFor: string | null;
  pendingComment: string;
  composerRef: React.RefObject<HTMLTextAreaElement | null>;
  onClose: () => void;
  onAskAi: () => void;
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
        <span className="flex-1 truncate text-sm text-muted-foreground">
          Inspecting Message {messageNumber} ·{" "}
          {message.authorName.split(" ")[0]}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Kbd>Esc</Kbd>
        </span>
      </div>

      <div className="flex items-center gap-2 border-b border-border bg-background/20 px-3 py-2">
        <button
          type="button"
          onClick={onAskAi}
          className="inline-flex flex-1 cursor-pointer items-center gap-1.5 rounded-md border border-teal-light bg-teal-lighter px-2.5 py-1.5 text-sm font-medium text-teal-darker transition-colors hover:bg-teal-light"
        >
          <Sparkles className="size-3.5" />
          <span>Ask the AI about Message {messageNumber}</span>
        </button>
        <span className="text-xs text-muted-foreground">
          or <Kbd>/</Kbd>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-5 p-4">
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
                  <CommentRow
                    key={c.id}
                    comment={c}
                    reactions={commentReactions[c.id] ?? {}}
                    reactionStripOpen={commentReactionStripFor === c.id}
                    onSetReactionsOpen={(open) =>
                      onSetCommentReactionsOpen(c.id, open)
                    }
                    onAddReaction={(emoji) => onAddCommentReaction(c.id, emoji)}
                  />
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

function CommentRow({
  comment,
  reactions,
  reactionStripOpen,
  onSetReactionsOpen,
  onAddReaction,
}: {
  comment: Comment;
  reactions: Partial<Record<Reaction, number>>;
  reactionStripOpen: boolean;
  onSetReactionsOpen: (open: boolean) => void;
  onAddReaction: (emoji: Reaction) => void;
}) {
  const reactionEntries = (Object.entries(reactions) as [Reaction, number][])
    .filter(([, n]) => n > 0);
  return (
    <li className="group/comment flex gap-2.5">
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-medium",
          comment.aiSuggested
            ? "bg-teal-lighter text-teal-darker"
            : "bg-muted text-muted-foreground",
        )}
        aria-hidden
      >
        {comment.aiSuggested ? (
          <Sparkles className="size-3.5" />
        ) : (
          comment.initials
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 text-sm">
          <span className="font-medium text-foreground">{comment.author}</span>
          {comment.aiSuggested && (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-lighter px-1.5 py-0.5 text-xs font-medium text-teal-darker">
              <Sparkles className="size-3" />
              Suggested by AI
            </span>
          )}
          <span className="text-muted-foreground">
            {formatRelative(comment.createdAt)}
          </span>
        </div>
        <p className="text-base text-foreground">{comment.body}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {reactionEntries.map(([emoji, count]) => (
            <span
              key={emoji}
              className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-1.5 py-0.5 text-xs text-muted-foreground"
            >
              <span aria-hidden>{emoji}</span>
              <span className="tabular-nums">{count}</span>
            </span>
          ))}
          <Popover open={reactionStripOpen} onOpenChange={onSetReactionsOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Add reaction"
                className={cn(
                  "flex cursor-pointer items-center gap-0.5 rounded-full border border-dashed border-border bg-background px-1.5 py-0.5 text-xs text-muted-foreground transition-all hover:bg-accent hover:text-foreground",
                  reactionEntries.length > 0 &&
                    "opacity-0 group-hover/comment:opacity-100",
                  reactionStripOpen && "opacity-100",
                )}
              >
                <Smile className="size-3" />
                <Plus className="size-2.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
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
                    className="flex size-7 cursor-pointer items-center justify-center rounded-md text-base transition-all hover:scale-110 hover:bg-accent"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
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

/* -------------------- AI chat drawer -------------------- */

function ChatDrawer({
  open,
  chat,
  draft,
  inputRef,
  threadRef,
  messages,
  discardedSuggestions,
  acceptedSuggestions,
  bottomOffsetPx,
  onOpen,
  onClose,
  onChangeDraft,
  onSubmit,
  onClickMessageRef,
  onAcceptSuggestion,
  onDiscardSuggestion,
}: {
  open: boolean;
  chat: ChatMessage[];
  draft: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  threadRef: React.RefObject<HTMLDivElement | null>;
  messages: SampleMessage[];
  discardedSuggestions: Set<string>;
  acceptedSuggestions: Set<string>;
  bottomOffsetPx: number;
  onOpen: () => void;
  onClose: () => void;
  onChangeDraft: (s: string) => void;
  onSubmit: () => void;
  onClickMessageRef: (id: string) => void;
  onAcceptSuggestion: (
    chatId: string,
    targetMessageId: string,
    body: string,
  ) => void;
  onDiscardSuggestion: (chatId: string) => void;
}) {
  if (!open) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="fixed bottom-0 left-0 right-0 z-30 flex h-12 cursor-pointer items-center justify-between border-t border-border bg-card/95 px-4 text-sm text-muted-foreground shadow-lg backdrop-blur-md transition-colors hover:bg-card hover:text-foreground"
      >
        <span className="flex items-center gap-2">
          <Sparkles className="size-4 text-teal-dark" />
          <span>Ask the AI about this ticket</span>
        </span>
        <span className="flex items-center gap-2 text-xs">
          <span className="opacity-60">press</span>
          <Kbd>/</Kbd>
          <span className="opacity-60">to open</span>
          <ChevronUp className="size-4" />
        </span>
      </button>
    );
  }

  return (
    <section
      className="fixed bottom-0 left-0 right-0 z-30 flex flex-col border-t border-border bg-card/95 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4 duration-200"
      style={{ height: `${bottomOffsetPx}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <header className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="flex size-6 items-center justify-center rounded-md bg-teal-lighter text-teal-darker">
            <Sparkles className="size-3.5" />
          </span>
          <span className="font-medium text-foreground">QA copilot</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            Ask about scores, request coaching notes, compare to ideal
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ChevronDown className="size-4" />
          <Kbd>Esc</Kbd>
        </button>
      </header>

      <div
        ref={threadRef}
        className="flex-1 overflow-y-auto px-4 py-3"
      >
        <ul className="space-y-3">
          {chat.map((m) => (
            <ChatMessageRow
              key={m.id}
              chatMessage={m}
              messages={messages}
              discarded={discardedSuggestions.has(m.id)}
              accepted={acceptedSuggestions.has(m.id)}
              onClickRef={onClickMessageRef}
              onAccept={(targetId, body) =>
                onAcceptSuggestion(m.id, targetId, body)
              }
              onDiscard={() => onDiscardSuggestion(m.id)}
            />
          ))}
        </ul>
      </div>

      <div className="border-t border-border p-3">
        <div className="relative">
          <Textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => onChangeDraft(e.target.value)}
            placeholder="Ask anything about this ticket — scores, coaching, patterns…"
            className="min-h-12 resize-none pr-24 text-base"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onSubmit();
              }
            }}
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={!draft.trim()}
            className={cn(
              "absolute bottom-2 right-2 inline-flex cursor-pointer items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-sm font-medium text-primary-foreground transition-opacity",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            <ArrowUp className="size-3.5" />
            <Kbd className="border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground">
              ⌘⏎
            </Kbd>
          </button>
        </div>
        <p className="mt-1.5 px-1 text-xs text-muted-foreground">
          The copilot is a thinking partner — it can suggest coaching notes,
          but only adds them when you click <em>Add as coaching note</em>.
        </p>
      </div>
    </section>
  );
}

function ChatMessageRow({
  chatMessage,
  messages,
  discarded,
  accepted,
  onClickRef,
  onAccept,
  onDiscard,
}: {
  chatMessage: ChatMessage;
  messages: SampleMessage[];
  discarded: boolean;
  accepted: boolean;
  onClickRef: (id: string) => void;
  onAccept: (targetId: string, body: string) => void;
  onDiscard: () => void;
}) {
  const isUser = chatMessage.role === "user";
  return (
    <li
      className={cn(
        "flex gap-2",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-teal-lighter text-teal-darker",
        )}
        aria-hidden
      >
        {isUser ? "YO" : <Sparkles className="size-3.5" />}
      </div>
      <div
        className={cn(
          "max-w-[78%] space-y-2",
          isUser ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn(
            "inline-block rounded-2xl px-3.5 py-2 text-base",
            isUser
              ? "rounded-tr-sm bg-primary/10 text-foreground"
              : "rounded-tl-sm bg-teal-lighter/60 text-foreground",
          )}
        >
          {chatMessage.blocks.map((b, i) =>
            b.kind === "text" ? (
              <span key={i}>{b.body}</span>
            ) : (
              <button
                key={i}
                type="button"
                onClick={() => onClickRef(b.messageId)}
                className="mx-0.5 inline-flex cursor-pointer items-center gap-1 rounded-full border border-teal-light bg-background px-1.5 py-0 align-baseline text-sm font-medium text-teal-darker transition-colors hover:bg-teal-lighter"
              >
                {b.label}
              </button>
            ),
          )}
        </div>

        {chatMessage.suggestion && !discarded && (
          <SuggestionCard
            targetMessageId={chatMessage.suggestion.targetMessageId}
            body={chatMessage.suggestion.body}
            messages={messages}
            accepted={accepted}
            onAccept={() =>
              onAccept(
                chatMessage.suggestion!.targetMessageId,
                chatMessage.suggestion!.body,
              )
            }
            onDiscard={onDiscard}
            onClickRef={onClickRef}
          />
        )}
        {chatMessage.suggestion && discarded && (
          <div className="rounded-lg border border-dashed border-border bg-background/40 px-3 py-1.5 text-xs text-muted-foreground">
            Suggestion discarded.
          </div>
        )}
      </div>
    </li>
  );
}

function SuggestionCard({
  targetMessageId,
  body,
  messages,
  accepted,
  onAccept,
  onDiscard,
  onClickRef,
}: {
  targetMessageId: string;
  body: string;
  messages: SampleMessage[];
  accepted: boolean;
  onAccept: () => void;
  onDiscard: () => void;
  onClickRef: (id: string) => void;
}) {
  const label = messageLabel(messages, targetMessageId);
  return (
    <div className="rounded-xl border border-teal-light bg-background/60 p-3 shadow-sm">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-teal-darker">
        <Sparkles className="size-3" />
        <span>Suggested coaching note</span>
        <span className="text-muted-foreground">·</span>
        <button
          type="button"
          onClick={() => onClickRef(targetMessageId)}
          className="cursor-pointer rounded-full border border-teal-light bg-background px-1.5 py-0 text-xs font-medium text-teal-darker transition-colors hover:bg-teal-lighter"
        >
          {label}
        </button>
      </div>
      <p className="text-base text-foreground">{body}</p>
      <div className="mt-2.5 flex items-center justify-end gap-2">
        {accepted ? (
          <span className="text-sm text-muted-foreground">
            ✓ Added as a comment on {label}.
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={onDiscard}
              className="cursor-pointer rounded-md px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={onAccept}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-teal-darker px-2.5 py-1 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              <MessageSquarePlus className="size-3.5" />
              Add as coaching note
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* -------------------- Keyboard hint bar (sits above chat drawer) -------------------- */

function KeyboardHintBar({
  chatOpen,
  bottomOffsetPx,
}: {
  chatOpen: boolean;
  bottomOffsetPx: number;
}) {
  // When the chat drawer is open the cheat sheet is one keystroke away — keep
  // the bar visible but slim. When closed, show the action keys.
  return (
    <div
      className="fixed left-1/2 z-30 flex h-8 -translate-x-1/2 items-center gap-3 rounded-full bg-foreground/90 px-3 text-sm text-background shadow-lg backdrop-blur transition-[bottom] duration-200"
      style={{ bottom: `${bottomOffsetPx}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <HintItem keys={["↑", "↓"]} label="navigate" />
      <Sep />
      <HintItem keys={["⏎"]} label="inspect" />
      <Sep />
      <HintItem keys={["C"]} label="comment" />
      <Sep />
      <HintItem keys={["T"]} label="categorize" />
      <Sep />
      <HintItem keys={["R"]} label="react" />
      <Sep />
      <HintItem keys={["/"]} label={chatOpen ? "focus chat" : "ask AI"} />
      <Sep />
      <HintItem keys={["?"]} label="more" />
    </div>
  );
}

function Sep() {
  return (
    <span className="opacity-40" aria-hidden>
      ·
    </span>
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

/* -------------------- Cheat sheet -------------------- */

function CheatSheet() {
  const groups: { title: string; rows: { keys: string[]; desc: string }[] }[] = [
    {
      title: "Navigate",
      rows: [
        { keys: ["↑"], desc: "Previous message" },
        { keys: ["↓"], desc: "Next message" },
        { keys: ["J"], desc: "Next (vim)" },
        { keys: ["K"], desc: "Previous (vim)" },
        { keys: ["⏎"], desc: "Open Inspect on focused message" },
        { keys: ["Esc"], desc: "Multi-level: chat → inspect → muted → clear" },
      ],
    },
    {
      title: "Coach",
      rows: [
        { keys: ["C"], desc: "Comment on focused message" },
        { keys: ["T"], desc: "Categorize (agent messages only)" },
        { keys: ["R"], desc: "React" },
        { keys: ["⌘", "⏎"], desc: "Post comment / send chat" },
      ],
    },
    {
      title: "AI copilot",
      rows: [
        { keys: ["/"], desc: "Open chat + focus input" },
        { keys: ["Esc"], desc: "Blur input → close drawer" },
        { keys: ["⌘", "⏎"], desc: "Send message" },
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
          <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <HelpCircle className="size-3.5" />
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
