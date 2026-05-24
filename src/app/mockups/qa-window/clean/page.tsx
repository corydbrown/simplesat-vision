"use client";

/**
 * Round-7 "clean" — tight refined.
 *
 * Variant differentiator: kbd hint badges are HIDDEN by default; the user
 * holds `Cmd` (Mac) / `Ctrl` (others) to fade them in across the page.
 * Shortcuts still WORK regardless — only their visual hints toggle.
 *
 * Other round-7 changes (shared with sibling `quiet`):
 *  - Slack-style on-message popup: icon-only, floating top-right of the
 *    bubble, overlapping its top edge by 50%. Opaque bg, never bleeds.
 *  - 5-dot citation scale (●●●●○) — reverted from numeric "4/5".
 *  - Arrow keys cross columns (→ enters Inspect, ← returns to convo) and
 *    cycle through Inspect nav stops (Add-citation → citations → composer
 *    → comments). Enter on a citation opens an inline 1-5 score editor;
 *    Up/Down cycles, Enter confirms, Esc cancels.
 *  - Click outside Inspect closes it. Click outside pickers/trays closes
 *    them. Column-contained popovers (reaction `+` in sidebar opens LEFT).
 *  - Notion-style comments (avatar + name + muted-er date + body + reactions
 *    + reply input). Composer Submit button bakes ⌘⏎ inside (always visible).
 *  - NO auto-focus on composer when Inspect opens — focus lands on the first
 *    nav stop (Add citation, or composer if no citations available).
 *  - Bottom convo padding so the last message has breathing room when
 *    arrow-navigating; subtle "End of conversation" marker beneath.
 *  - Bug fix: clicking the React icon in the on-message popup opens exactly
 *    one tray. Single source-of-truth: `reactionTrayMessageId`. The chip-row
 *    `+` button is independent (its own local Popover open state).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

/** What the Inspect panel currently has focused for arrow-key navigation. */
type InspectFocus =
  | { kind: "add-citation" }
  | { kind: "citation"; key: string }
  | { kind: "composer" }
  | { kind: "comment"; id: string };

/* -------------------- Hold-Cmd kbd hint context -------------------- */

const KbdHintContext = createContext(false);

function useKbdHints() {
  return useContext(KbdHintContext);
}

/** Wrap a `<Kbd>` so it fades in/out based on the page-wide hold-Cmd state.
 *  Space is reserved either way (opacity-only) so layouts stay stable.
 *  Use `collapse` when reserving space would look obviously broken
 *  (e.g. a trailing "· Esc" in a header). */
function KbdHint({
  children,
  collapse,
  className,
}: {
  children: React.ReactNode;
  collapse?: boolean;
  className?: string;
}) {
  const visible = useKbdHints();
  if (collapse && !visible) return null;
  return (
    <span
      aria-hidden={!visible}
      className={cn(
        "inline-flex transition-opacity duration-150",
        visible ? "opacity-100" : "opacity-0 pointer-events-none",
        className,
      )}
    >
      <Kbd>{children}</Kbd>
    </span>
  );
}

/** Page-level hook: returns true while the user is holding Cmd (Mac) or
 *  Ctrl (other OS). Also resets on window blur (Cmd+Tab leaves the page
 *  thinking the key is still down without this). */
function useHoldModifier() {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    function down(e: globalThis.KeyboardEvent) {
      if (e.key === "Meta" || e.key === "Control") setHeld(true);
    }
    function up(e: globalThis.KeyboardEvent) {
      if (e.key === "Meta" || e.key === "Control") setHeld(false);
    }
    function blur() {
      setHeld(false);
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);
  return held;
}

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

const INITIAL_COMMENT_REACTIONS: Record<string, ReactionState> = {
  c1: { "👍": ["Diego Park"] },
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

export default function CleanMockupPage() {
  const ticket = sampleTicket;
  const { evaluation, messages } = ticket;

  const kbdHintsVisible = useHoldModifier();

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [inspectFocus, setInspectFocus] = useState<InspectFocus>({
    kind: "add-citation",
  });
  /** When true, arrow keys move inspect focus instead of convo focus. */
  const [focusInInspect, setFocusInInspect] = useState(false);
  const [inspectAddingCategory, setInspectAddingCategory] = useState(false);
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null);
  const [editingCitationKey, setEditingCitationKey] = useState<string | null>(
    null,
  );
  const [pendingScore, setPendingScore] = useState<number>(3);
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
  const [reactionTrayMessageId, setReactionTrayMessageId] = useState<
    string | null
  >(null);
  const [pendingComment, setPendingComment] = useState("");
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

  /** Build the ordered list of Inspect nav stops for arrow-key cycling. */
  const inspectStops = useMemo<InspectFocus[]>(() => {
    if (!inspectMessage) return [];
    const isCustomer = inspectMessage.role === "customer";
    const cits = citationsByMessage.get(inspectMessage.id) ?? [];
    const comments = commentsByMsg[inspectMessage.id] ?? [];
    const stops: InspectFocus[] = [];
    if (!isCustomer) {
      stops.push({ kind: "add-citation" });
      for (const c of cits) stops.push({ kind: "citation", key: c.key });
    }
    stops.push({ kind: "composer" });
    for (const c of comments) stops.push({ kind: "comment", id: c.id });
    return stops;
  }, [inspectMessage, citationsByMessage, commentsByMsg]);

  /* ---- Mutators ---- */

  const openInspect = useCallback(
    (
      id: string,
      opts?: {
        focus?: InspectFocus;
        addCitation?: boolean;
      },
    ) => {
      setInspectId(id);
      setFocusedId(id);
      setMutedCategoryId(null);
      setReactionTrayMessageId(null);
      setInspectAddingCategory(opts?.addCitation ?? false);
      setPendingCategoryId(null);
      setEditingCitationKey(null);
      setPendingComment("");
      setFocusInInspect(false);
      // Default initial focus: first nav stop in Inspect. For agent messages
      // that's "Add citation"; for customer messages that's the composer.
      // (Brief: NO auto-focus on the comment composer textarea — focus lands
      // on the first nav item.)
      const msg = messages.find((m) => m.id === id);
      const initial: InspectFocus =
        opts?.focus ??
        (msg?.role === "customer"
          ? { kind: "composer" }
          : { kind: "add-citation" });
      setInspectFocus(initial);
    },
    [messages],
  );

  const closeInspect = useCallback(() => {
    setInspectId(null);
    setPendingComment("");
    setInspectAddingCategory(false);
    setPendingCategoryId(null);
    setEditingCitationKey(null);
    setFocusInInspect(false);
    setInspectFocus({ kind: "add-citation" });
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
    setReactionsByMsg((prev) => toggleEmojiInMap(prev, messageId, emoji));
  }

  function toggleCommentReaction(commentId: string, emoji: Reaction) {
    setReactionsByComment((prev) => toggleEmojiInMap(prev, commentId, emoji));
  }

  /** Scroll a message into view and flash it briefly — used by the
   *  `Message N` chips inside AI reasoning text. */
  const flashMessage = useCallback((id: string) => {
    const el = messageRefs.current.get(id);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashId(id);
    setTimeout(() => setFlashId((v) => (v === id ? null : v)), 1400);
  }, []);

  /* ---- Keyboard navigation ---- */

  const moveConvoFocus = useCallback(
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

  const moveInspectFocus = useCallback(
    (delta: 1 | -1) => {
      if (inspectStops.length === 0) return;
      const idx = inspectStops.findIndex((s) => focusKeyOf(s) === focusKeyOf(inspectFocus));
      const nextIdx = Math.max(
        0,
        Math.min(inspectStops.length - 1, (idx < 0 ? 0 : idx) + delta),
      );
      setInspectFocus(inspectStops[nextIdx]);
    },
    [inspectStops, inspectFocus],
  );

  useEffect(() => {
    function handler(e: globalThis.KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "TEXTAREA" || target?.tagName === "INPUT";

      // `?` toggles cheat sheet anywhere except when typing.
      if (e.key === "?" && !isTyping) {
        e.preventDefault();
        setCheatOpen((v) => !v);
        return;
      }
      if (cheatOpen) return;

      /* Multi-Esc peel:
       *   1. Score-editor mode → cancel
       *   2. Reaction tray
       *   3. Inspect category/score picker
       *   4. Blur textarea
       *   5. Exit Inspect
       *   6. Clear category mute
       */
      if (e.key === "Escape") {
        if (editingCitationKey) {
          e.preventDefault();
          setEditingCitationKey(null);
          return;
        }
        if (reactionTrayMessageId) {
          e.preventDefault();
          setReactionTrayMessageId(null);
          return;
        }
        if (inspectAddingCategory || pendingCategoryId) {
          e.preventDefault();
          if (pendingCategoryId && inspectId) {
            removeCitation(inspectId, pendingCategoryId);
          }
          setInspectAddingCategory(false);
          setPendingCategoryId(null);
          return;
        }
        if (isTyping) {
          e.preventDefault();
          (target as HTMLElement).blur();
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

      // Inside textareas / inputs, only Cmd+Enter and Esc work.
      if (isTyping) return;

      // ----- Inspect-focus arrow nav (highest priority once Inspect is open) -----
      if (inspectId && focusInInspect) {
        // Score editor: Up/Down cycles 1-5, Enter confirms, Esc cancels.
        if (editingCitationKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
          e.preventDefault();
          setPendingScore((v) => clampScore(v + (e.key === "ArrowUp" ? 1 : -1)));
          return;
        }
        if (editingCitationKey && e.key === "Enter") {
          e.preventDefault();
          const cit = citations.find((c) => c.key === editingCitationKey);
          if (cit) setCitationScore(cit.messageId, cit.categoryId, pendingScore);
          setEditingCitationKey(null);
          return;
        }

        // Category picker: number 1-N picks; otherwise fall through.
        if (inspectAddingCategory && !pendingCategoryId && inspectId) {
          const available = evaluation.categories.filter(
            (c) =>
              !citations.some(
                (cit) =>
                  cit.messageId === inspectId && cit.categoryId === c.id,
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
              setInspectFocus({ kind: "citation", key: `${inspectId}::${cat.id}` });
            } else {
              setPendingCategoryId(cat.id);
            }
            return;
          }
        }
        // Score picker (after picking a non-binary category): 1-5 sets.
        if (pendingCategoryId && inspectId) {
          const n = Number(e.key);
          if (Number.isInteger(n) && n >= 1 && n <= 5) {
            e.preventDefault();
            setCitationScore(inspectId, pendingCategoryId, n);
            setInspectAddingCategory(false);
            setInspectFocus({ kind: "citation", key: `${inspectId}::${pendingCategoryId}` });
            setPendingCategoryId(null);
            return;
          }
        }

        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setFocusInInspect(false);
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          moveInspectFocus(1);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          moveInspectFocus(-1);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          if (inspectFocus.kind === "add-citation") {
            setInspectAddingCategory(true);
          } else if (inspectFocus.kind === "citation") {
            const cit = citations.find((c) => c.key === inspectFocus.key);
            if (cit) {
              setEditingCitationKey(cit.key);
              setPendingScore(cit.score ?? 3);
            }
          } else if (inspectFocus.kind === "composer") {
            // Drop the user into the textarea so they can type.
            requestAnimationFrame(() => composerRef.current?.focus());
          }
          return;
        }
        return;
      }

      // ----- Reaction tray (numeric pick) -----
      if (reactionTrayMessageId) {
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= REACTIONS.length) {
          e.preventDefault();
          toggleReaction(reactionTrayMessageId, REACTIONS[n - 1]);
          setReactionTrayMessageId(null);
        }
        return;
      }

      // ----- Convo nav -----
      switch (e.key) {
        case "ArrowDown":
        case "j":
        case "J":
          e.preventDefault();
          moveConvoFocus(1);
          return;
        case "ArrowUp":
        case "k":
        case "K":
          e.preventDefault();
          moveConvoFocus(-1);
          return;
        case "ArrowRight":
          if (inspectId) {
            e.preventDefault();
            setFocusInInspect(true);
          }
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
        openInspect(focusedId, { focus: { kind: "composer" } });
        return;
      }
      if (e.key === "t" || e.key === "T") {
        if (focused.role !== "agent") return;
        e.preventDefault();
        openInspect(focusedId, { addCitation: true });
        setFocusInInspect(true);
        return;
      }
      if (e.key === "r" || e.key === "R") {
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
    focusInInspect,
    inspectFocus,
    editingCitationKey,
    pendingScore,
    mutedCategoryId,
    focusedId,
    messages,
    evaluation.categories,
    citations,
    inspectStops,
    moveConvoFocus,
    moveInspectFocus,
    openInspect,
    closeInspect,
  ]);

  /* ---- Side effects ---- */

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

  /** Click outside Inspect → close it.
   *  Bubble and chip clicks stopPropagation, so they re-open Inspect for the
   *  clicked message without first closing. Doc listener only catches
   *  truly-background clicks (header, prompt bar, padding). */
  useEffect(() => {
    if (!inspectId) return;
    function onDocClick(e: MouseEvent) {
      const sidebar = sidebarRef.current;
      if (sidebar?.contains(e.target as Node)) return;
      closeInspect();
    }
    const t = window.setTimeout(
      () => document.addEventListener("click", onDocClick),
      0,
    );
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("click", onDocClick);
    };
  }, [inspectId, closeInspect]);

  /** Click outside the sidebar's category card → clear category filter. */
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
    <KbdHintContext.Provider value={kbdHintsVisible}>
      <TooltipProvider delayDuration={200}>
        <div className="relative">
          <div className="grid grid-cols-[1fr_380px] gap-6">
            <div className="min-w-0">
              <TicketHeader ticket={ticket} />
              <PromptBar
                activityOn={activityOn}
                onToggleActivity={() => setActivityOn((v) => !v)}
                onOpenCheat={() => setCheatOpen(true)}
              />

              <div className="mt-4 space-y-3 pb-[150px]">
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
                        onHoverChange={(h) =>
                          setHoverState(setHoveredId, msg.id, h)
                        }
                        onClickBubble={() => openInspect(msg.id)}
                        onClickComment={() =>
                          openInspect(msg.id, { focus: { kind: "composer" } })
                        }
                        onClickCite={() => {
                          if (msg.role !== "agent") return;
                          openInspect(msg.id, { addCitation: true });
                          setFocusInInspect(true);
                        }}
                        onClickReact={() => setReactionTrayMessageId(msg.id)}
                        onClickInspect={() => openInspect(msg.id)}
                        onClickCitationChip={(catId) =>
                          openInspect(msg.id, {
                            focus: {
                              kind: "citation",
                              key: `${msg.id}::${catId}`,
                            },
                          })
                        }
                        onToggleReaction={(emoji) =>
                          toggleReaction(msg.id, emoji)
                        }
                        onCloseReactionTray={() =>
                          setReactionTrayMessageId(null)
                        }
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
                <EndOfConversation />
              </div>
            </div>

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
                    commentReactions={reactionsByComment}
                    categories={evaluation.categories}
                    pendingComment={pendingComment}
                    composerRef={composerRef}
                    inspectFocus={inspectFocus}
                    focusActive={focusInInspect}
                    editingCitationKey={editingCitationKey}
                    pendingScore={pendingScore}
                    addingCategory={inspectAddingCategory}
                    pendingCategoryId={pendingCategoryId}
                    onClose={closeInspect}
                    onPendingCommentChange={setPendingComment}
                    onSubmitComment={submitComment}
                    onFocusStop={(stop) => {
                      setInspectFocus(stop);
                      setFocusInInspect(true);
                    }}
                    onStartScoreEditor={(key, score) => {
                      setEditingCitationKey(key);
                      setPendingScore(score);
                    }}
                    onConfirmScoreEditor={() => {
                      const cit = citations.find(
                        (c) => c.key === editingCitationKey,
                      );
                      if (cit)
                        setCitationScore(
                          cit.messageId,
                          cit.categoryId,
                          pendingScore,
                        );
                      setEditingCitationKey(null);
                    }}
                    onCancelScoreEditor={() => setEditingCitationKey(null)}
                    onChangePendingScore={(n) => setPendingScore(n)}
                    onStartAddCitation={() => {
                      setInspectAddingCategory(true);
                      setFocusInInspect(true);
                    }}
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
                        setInspectFocus({
                          kind: "citation",
                          key: `${inspectMessage.id}::${catId}`,
                        });
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
                      setInspectFocus({
                        kind: "citation",
                        key: `${inspectMessage.id}::${pendingCategoryId}`,
                      });
                      setPendingCategoryId(null);
                    }}
                    onSetCitationScore={(catId, score) =>
                      setCitationScore(inspectMessage.id, catId, score)
                    }
                    onRemoveCitation={(catId) =>
                      removeCitation(inspectMessage.id, catId)
                    }
                    onJumpToMessage={(id) => flashMessage(id)}
                    onToggleCommentReaction={toggleCommentReaction}
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
        </div>
      </TooltipProvider>
    </KbdHintContext.Provider>
  );
}

/* -------------------- Small helpers -------------------- */

function setHoverState(
  setter: (v: string | null) => void,
  id: string,
  hovering: boolean,
) {
  setter(hovering ? id : null);
}

function clampScore(n: number) {
  return Math.max(1, Math.min(5, n));
}

function focusKeyOf(f: InspectFocus): string {
  switch (f.kind) {
    case "add-citation":
      return "add-citation";
    case "citation":
      return `citation:${f.key}`;
    case "composer":
      return "composer";
    case "comment":
      return `comment:${f.id}`;
  }
}

function toggleEmojiInMap(
  prev: Record<string, ReactionState>,
  key: string,
  emoji: Reaction,
): Record<string, ReactionState> {
  const curr = prev[key] ?? {};
  const list = curr[emoji] ?? [];
  const has = list.includes("You");
  const nextList = has ? list.filter((n) => n !== "You") : [...list, "You"];
  const nextMap = { ...curr };
  if (nextList.length === 0) delete nextMap[emoji];
  else nextMap[emoji] = nextList;
  return { ...prev, [key]: nextMap };
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
          Hover any message for actions. Hold{" "}
          <span className="rounded border border-border bg-muted px-1 font-mono text-[10px] text-muted-foreground">
            ⌘
          </span>{" "}
          to reveal shortcuts ·{" "}
          <button
            type="button"
            onClick={onOpenCheat}
            className="cursor-pointer underline-offset-2 hover:underline"
          >
            press <span className="rounded border border-border bg-muted px-1 font-mono text-[10px] text-muted-foreground">?</span> for the cheat sheet
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

function EndOfConversation() {
  return (
    <div className="flex items-center gap-3 pt-3 text-xs text-muted-foreground/60">
      <div className="h-px flex-1 bg-border/60" />
      <span>End of conversation</span>
      <div className="h-px flex-1 bg-border/60" />
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
  onClickBubble: () => void;
  onClickComment: () => void;
  onClickCite: () => void;
  onClickReact: () => void;
  onClickInspect: () => void;
  onClickCitationChip: (categoryId: string) => void;
  onToggleReaction: (emoji: Reaction) => void;
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
          {/* Slack-style top-right popup — sits half above the bubble's top
              edge, regardless of which side the bubble is on. */}
          {popupVisible && (
            <BubblePopup
              hideCite={isCustomer}
              onComment={onClickComment}
              onCite={onClickCite}
              onReact={onClickReact}
              onInspect={onClickInspect}
            />
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClickBubble();
            }}
            className={cn(
              "group relative inline-block max-w-full cursor-pointer rounded-2xl border px-4 py-3 pb-5 text-left text-base transition-all duration-200 ease-out",
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
            {message.body}
            <span
              aria-hidden
              className="absolute bottom-1 right-2.5 select-none text-xs tabular-nums text-muted-foreground/50"
            >
              M{messageNumber}
            </span>
          </button>
        </div>

        {(citations.length > 0 || hasComments || hasReactions) && (
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
            {hasReactions && (
              <ChipRowReactionAdd
                onPick={(emoji) => onToggleReaction(emoji)}
                reactions={reactions}
              />
            )}
          </div>
        )}

        {/* Inline reaction tray — single source of truth for popup React icon
            click and the `R` keyboard shortcut. Renders regardless of whether
            the bubble already has reactions (no duplicate-popover bug). */}
        {reactionTrayOpen && (
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

/* -------------------- Slack-style on-message popup -------------------- */

function BubblePopup({
  hideCite,
  onComment,
  onCite,
  onReact,
  onInspect,
}: {
  hideCite: boolean;
  onComment: () => void;
  onCite: () => void;
  onReact: () => void;
  onInspect: () => void;
}) {
  return (
    <div
      // Sits at the top-right of the bubble, 50% overlapping the top edge.
      // Always right-side regardless of sender column (Slack pattern).
      className={cn(
        "absolute right-3 top-0 z-20 -translate-y-1/2",
        "flex items-stretch gap-0.5 rounded-md border border-border bg-popover px-1 py-0.5 shadow-md",
        "animate-in fade-in slide-in-from-top-1 duration-150",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <PopupButton
        icon={<MessageSquarePlus className="size-4" />}
        kbd="C"
        label="Comment"
        onClick={onComment}
      />
      {!hideCite && (
        <PopupButton
          icon={<Tag className="size-4" />}
          kbd="T"
          label="Cite"
          onClick={onCite}
        />
      )}
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
}: {
  icon: React.ReactNode;
  kbd: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="flex flex-col items-center gap-0.5 rounded-sm px-1.5 py-1 text-foreground transition-colors hover:bg-accent cursor-pointer"
        >
          {icon}
          <KbdHint>{kbd}</KbdHint>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-sm">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/* -------------------- Citation chip (5-dot scale) -------------------- */

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

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-l-2 px-2 py-0.5 text-sm font-medium shadow-sm transition-all hover:-translate-y-px hover:shadow-md",
        styles.border,
        "border-y-border border-r-border",
        styles.bgSoft,
      )}
    >
      <span className={cn("min-w-0 truncate", styles.textDark)}>
        {category.name}
      </span>
      {isBinary ? (
        <span className={cn("text-xs uppercase tracking-wide", styles.textDark)}>
          {effectiveScore === 1 ? "Pass" : "Fail"}
        </span>
      ) : (
        <DotScale value={effectiveScore} hue={hue} />
      )}
      {citation.aiSuggested && (
        <Sparkles
          className={cn("size-2.5 shrink-0", styles.text)}
          aria-label="AI suggested"
        />
      )}
    </button>
  );
}

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
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`Score ${value} of 5`}
    >
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

/* -------------------- Reactions -------------------- */

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

/** Reaction `+` button used in the chip row UNDER a bubble. Local open
 *  state — independent of the page-wide `reactionTrayMessageId`, so clicking
 *  the popup React icon (which opens the inline tray) and clicking this `+`
 *  (which opens a popover) never both fire. */
function ChipRowReactionAdd({
  onPick,
  reactions,
  side = "bottom",
}: {
  onPick: (emoji: Reaction) => void;
  reactions: ReactionState;
  side?: "left" | "bottom";
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
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
        side={side}
        align={side === "left" ? "start" : "start"}
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
    <div
      className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-md animate-in fade-in slide-in-from-top-1 duration-150"
      onClick={(e) => e.stopPropagation()}
    >
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
            <KbdHint>{String(idx + 1)}</KbdHint>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onCancel}
        className="ml-1 cursor-pointer rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <span>cancel</span>
        <KbdHint className="ml-1">Esc</KbdHint>
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
  commentReactions,
  categories,
  pendingComment,
  composerRef,
  inspectFocus,
  focusActive,
  editingCitationKey,
  pendingScore,
  addingCategory,
  pendingCategoryId,
  onClose,
  onPendingCommentChange,
  onSubmitComment,
  onFocusStop,
  onStartScoreEditor,
  onConfirmScoreEditor,
  onCancelScoreEditor,
  onChangePendingScore,
  onStartAddCitation,
  onCancelAddCitation,
  onPickCategory,
  onPickPendingScore,
  onSetCitationScore,
  onRemoveCitation,
  onJumpToMessage,
  onToggleCommentReaction,
}: {
  message: SampleMessage;
  messageNumber: number;
  messageIndex: Map<string, number>;
  citations: Citation[];
  comments: Comment[];
  commentReactions: Record<string, ReactionState>;
  categories: SampleCategory[];
  pendingComment: string;
  composerRef: React.RefObject<HTMLTextAreaElement | null>;
  inspectFocus: InspectFocus;
  focusActive: boolean;
  editingCitationKey: string | null;
  pendingScore: number;
  addingCategory: boolean;
  pendingCategoryId: string | null;
  onClose: () => void;
  onPendingCommentChange: (s: string) => void;
  onSubmitComment: () => void;
  onFocusStop: (stop: InspectFocus) => void;
  onStartScoreEditor: (key: string, score: number) => void;
  onConfirmScoreEditor: () => void;
  onCancelScoreEditor: () => void;
  onChangePendingScore: (n: number) => void;
  onStartAddCitation: () => void;
  onCancelAddCitation: () => void;
  onPickCategory: (catId: string) => void;
  onPickPendingScore: (score: number) => void;
  onSetCitationScore: (catId: string, score: number) => void;
  onRemoveCitation: (catId: string) => void;
  onJumpToMessage: (messageId: string) => void;
  onToggleCommentReaction: (commentId: string, emoji: Reaction) => void;
}) {
  const isCustomer = message.role === "customer";
  const availableCategories = categories.filter(
    (c) => !citations.some((cit) => cit.categoryId === c.id),
  );
  const pendingCategory = pendingCategoryId
    ? categories.find((c) => c.id === pendingCategoryId) ?? null
    : null;
  const kbdVisible = useKbdHints();

  return (
    <div
      className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-card/95 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-right-2 duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-border bg-background/40 px-2 py-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to overview"
          className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          <span>Back</span>
          {kbdVisible && (
            <>
              <span aria-hidden className="text-muted-foreground/60">
                ·
              </span>
              <Kbd>Esc</Kbd>
            </>
          )}
        </button>
        <span className="pr-1 text-xs text-muted-foreground">
          Message {messageNumber}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-5 p-4">
          {!isCustomer &&
            (citations.length > 0 || availableCategories.length > 0) && (
              <section>
                <div className="space-y-1.5">
                  {citations.map((c) => {
                    const cat = categories.find((x) => x.id === c.categoryId);
                    if (!cat) return null;
                    const effectiveScore = c.score ?? cat.effectiveScore;
                    const navFocused =
                      focusActive &&
                      inspectFocus.kind === "citation" &&
                      inspectFocus.key === c.key;
                    const editing = editingCitationKey === c.key;
                    return (
                      <InspectCitationRow
                        key={c.key}
                        citation={c}
                        category={cat}
                        effectiveScore={effectiveScore}
                        navFocused={navFocused}
                        editing={editing}
                        pendingScore={pendingScore}
                        onFocus={() =>
                          onFocusStop({ kind: "citation", key: c.key })
                        }
                        onStartEdit={() =>
                          onStartScoreEditor(c.key, c.score ?? cat.effectiveScore)
                        }
                        onConfirmEdit={onConfirmScoreEditor}
                        onCancelEdit={onCancelScoreEditor}
                        onChangePending={onChangePendingScore}
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
                        onFocus={() => onFocusStop({ kind: "add-citation" })}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground",
                          focusActive &&
                            inspectFocus.kind === "add-citation" &&
                            "border-solid border-primary/40 bg-accent/30 text-foreground ring-1 ring-ring",
                        )}
                      >
                        <Plus className="size-3.5" />
                        <span>Add citation</span>
                      </button>
                    )
                  )}
                </div>
              </section>
            )}

          {comments.length > 0 && (
            <section>
              <div className="mb-2 px-1">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Comments
                </h3>
              </div>
              <ul className="space-y-3">
                {comments.map((c) => {
                  const navFocused =
                    focusActive &&
                    inspectFocus.kind === "comment" &&
                    inspectFocus.id === c.id;
                  return (
                    <CommentRow
                      key={c.id}
                      comment={c}
                      reactions={commentReactions[c.id] ?? {}}
                      navFocused={navFocused}
                      onFocus={() => onFocusStop({ kind: "comment", id: c.id })}
                      onToggleReaction={(emoji) =>
                        onToggleCommentReaction(c.id, emoji)
                      }
                    />
                  );
                })}
              </ul>
            </section>
          )}

          <section>
            <CommentComposer
              ref={composerRef}
              value={pendingComment}
              onChange={onPendingCommentChange}
              onSubmit={onSubmitComment}
              onFocusContainer={() => onFocusStop({ kind: "composer" })}
              isNavFocused={focusActive && inspectFocus.kind === "composer"}
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
  navFocused,
  editing,
  pendingScore,
  onFocus,
  onStartEdit,
  onConfirmEdit,
  onCancelEdit,
  onChangePending,
  onSetScore,
  onRemove,
  reasoning,
  messageIndex,
  onJumpToMessage,
}: {
  citation: Citation;
  category: SampleCategory;
  effectiveScore: number;
  navFocused: boolean;
  editing: boolean;
  pendingScore: number;
  onFocus: () => void;
  onStartEdit: () => void;
  onConfirmEdit: () => void;
  onCancelEdit: () => void;
  onChangePending: (n: number) => void;
  onSetScore: (s: number) => void;
  onRemove: () => void;
  reasoning: string;
  messageIndex: Map<string, number>;
  onJumpToMessage: (messageId: string) => void;
}) {
  const styles = HUE[CATEGORY_HUE[category.id]];
  const isBinary = category.scaleType === "binary";
  const displayScore = editing && !isBinary ? pendingScore : effectiveScore;
  return (
    <div
      className={cn(
        "rounded-lg border transition-all",
        styles.borderSoft,
        styles.bgSoft,
        navFocused && "shadow-sm ring-2 ring-inset",
        navFocused && styles.ring,
      )}
    >
      <button
        type="button"
        onClick={() => {
          onFocus();
          if (!isBinary) onStartEdit();
        }}
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
        {isBinary ? (
          <span className={cn("shrink-0 text-sm font-medium", styles.textDark)}>
            {effectiveScore === 1 ? "Pass" : "Fail"}
          </span>
        ) : (
          <DotScale value={displayScore} hue={CATEGORY_HUE[category.id]} size="md" />
        )}
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
      {navFocused && !editing && (
        <div className="space-y-2 px-3 pb-2.5 pt-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
          <p className="text-sm italic text-muted-foreground">
            <ReasoningText
              text={reasoning}
              messageIndex={messageIndex}
              onJump={onJumpToMessage}
            />
          </p>
        </div>
      )}
      {editing && !isBinary && (
        <div className="space-y-2 px-3 pb-2.5 pt-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onMouseEnter={() => onChangePending(n)}
                onClick={() => {
                  onSetScore(n);
                  onConfirmEdit();
                }}
                className={cn(
                  "size-8 cursor-pointer rounded-md border text-sm font-medium tabular-nums transition-all hover:scale-105",
                  n === pendingScore
                    ? cn(styles.bg, "border-transparent text-white shadow-sm")
                    : cn("border-border bg-background", styles.textDark),
                )}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={onCancelEdit}
              className="ml-1 cursor-pointer rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <KbdHint collapse>Esc</KbdHint>
              <span className="ml-1">cancel</span>
            </button>
          </div>
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
        <span>Pick a category</span>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer transition-colors hover:text-foreground"
        >
          <KbdHint collapse>Esc</KbdHint>
          <span className="ml-1">cancel</span>
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
                <KbdHint>{String(idx + 1)}</KbdHint>
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
          Score {category.name}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <KbdHint collapse>Esc</KbdHint>
          <span className="ml-1">cancel</span>
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
            <KbdHint>{String(n)}</KbdHint>
          </button>
        ))}
      </div>
    </div>
  );
}

function CommentRow({
  comment,
  reactions,
  navFocused,
  onFocus,
  onToggleReaction,
}: {
  comment: Comment;
  reactions: ReactionState;
  navFocused: boolean;
  onFocus: () => void;
  onToggleReaction: (emoji: Reaction) => void;
}) {
  const [replyValue, setReplyValue] = useState("");
  const reactionEntries = Object.entries(reactions).filter(
    ([, names]) => names.length > 0,
  ) as [Reaction, string[]][];
  return (
    <li
      onClick={onFocus}
      className={cn(
        "flex gap-2.5 rounded-lg p-2 transition-colors",
        navFocused
          ? "bg-accent/40 ring-2 ring-ring"
          : "hover:bg-accent/20",
      )}
    >
      <div
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground"
        aria-hidden
      >
        {comment.initials}
      </div>
      <div className="min-w-0 flex-1 space-y-1 text-left">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-foreground">
            {comment.author}
          </span>
          <span className="text-xs text-muted-foreground/70">
            {formatRelative(comment.createdAt)}
          </span>
        </div>
        <p className="text-left text-base text-foreground">{comment.body}</p>
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {reactionEntries.map(([emoji, names]) => (
            <ReactionChip
              key={emoji}
              emoji={emoji}
              names={names}
              onClick={() => onToggleReaction(emoji)}
            />
          ))}
          <ChipRowReactionAdd
            onPick={(emoji) => onToggleReaction(emoji)}
            reactions={reactions}
            side="left"
          />
        </div>
        <input
          type="text"
          value={replyValue}
          onChange={(e) => setReplyValue(e.target.value)}
          placeholder="Reply…"
          onClick={(e) => e.stopPropagation()}
          className="mt-1 w-full rounded-md border border-border bg-background/60 px-2 py-1 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
    </li>
  );
}

function CommentComposer({
  ref,
  value,
  onChange,
  onSubmit,
  onFocusContainer,
  isNavFocused,
}: {
  ref: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (s: string) => void;
  onSubmit: () => void;
  onFocusContainer: () => void;
  isNavFocused: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg transition-all",
        isNavFocused && "ring-2 ring-ring",
      )}
      onClick={onFocusContainer}
    >
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
          {/* The Submit button's ⌘⏎ is the always-visible kbd exception
              (primary action). It does NOT use KbdHint. */}
          <span className="flex items-center gap-0.5">
            <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-primary-foreground/20 bg-primary-foreground/10 px-1 font-sans text-[10px] font-medium">
              ⌘
            </kbd>
            <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-primary-foreground/20 bg-primary-foreground/10 px-1 font-sans text-[10px] font-medium">
              ↵
            </kbd>
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
      title: "Reveal",
      rows: [
        { keys: ["⌘"], desc: "Hold to reveal all kbd hints" },
      ],
    },
    {
      title: "Navigate",
      rows: [
        { keys: ["↑", "↓"], desc: "Move focus in convo" },
        { keys: ["→"], desc: "Enter Inspect" },
        { keys: ["←"], desc: "Back to convo" },
        { keys: ["↵"], desc: "Inspect focused / expand citation" },
      ],
    },
    {
      title: "Coach",
      rows: [
        { keys: ["C"], desc: "Comment" },
        { keys: ["T"], desc: "Cite (agent only)" },
        { keys: ["R"], desc: "React (inline tray)" },
      ],
    },
    {
      title: "Score editor",
      rows: [
        { keys: ["↑", "↓"], desc: "Cycle 1-5" },
        { keys: ["↵"], desc: "Confirm" },
        { keys: ["Esc"], desc: "Cancel" },
      ],
    },
    {
      title: "Pickers",
      rows: [
        { keys: ["1", "…", "5"], desc: "Pick category / score" },
        { keys: ["1", "…", "6"], desc: "Pick reaction" },
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
      title: "Esc multi-step",
      rows: [{ keys: ["Esc"], desc: "tray → picker → blur → Inspect → root" }],
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
