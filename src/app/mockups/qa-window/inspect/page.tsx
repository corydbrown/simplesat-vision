"use client";

import { useMemo, useRef, useState } from "react";
import {
  CircleDot,
  MessageSquarePlus,
  Plus,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import {
  sampleTicket,
  type SampleCategory,
  type SampleMessage,
} from "@/lib/mockups/sample-data";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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

type Citation = {
  key: string;
  messageId: string;
  categoryId: string;
  /** override score for the citation (likert categories only). null = use category score. */
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
  /** anchor between message ids: appears after the message with this id. "start" anchors before msg_1. */
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

export default function InspectMockupPage() {
  const ticket = sampleTicket;
  const { evaluation, messages } = ticket;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mutedCategoryId, setMutedCategoryId] = useState<string | null>(null);
  const [activityOn, setActivityOn] = useState(false);
  const [citations, setCitations] = useState<Citation[]>(INITIAL_CITATIONS);
  const [commentsByMsg, setCommentsByMsg] =
    useState<Record<string, Comment[]>>(INITIAL_COMMENTS);
  const [pendingComment, setPendingComment] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [changingScoreFor, setChangingScoreFor] = useState<string | null>(null);

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

  const mutedCitedIds = useMemo(() => {
    if (!mutedCategoryId) return null;
    const cat = evaluation.categories.find((c) => c.id === mutedCategoryId);
    if (!cat) return null;
    return new Set(
      citations
        .filter((c) => c.categoryId === mutedCategoryId)
        .map((c) => c.messageId),
    );
  }, [mutedCategoryId, evaluation.categories, citations]);

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

  function resetInspectEphemerals() {
    setAddingCategory(false);
    setChangingScoreFor(null);
    setPendingComment("");
  }

  function selectMessage(id: string) {
    if (id !== selectedId) resetInspectEphemerals();
    setSelectedId(id);
    setMutedCategoryId(null);
  }

  function clearSelection() {
    if (selectedId !== null) resetInspectEphemerals();
    setSelectedId(null);
  }

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
    setCitations((prev) =>
      prev.map((c) =>
        c.messageId === messageId && c.categoryId === categoryId
          ? { ...c, score }
          : c,
      ),
    );
    setChangingScoreFor(null);
  }

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
    setAddingCategory(false);
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

  // Activity events grouped by anchor message id (for inline rendering)
  const activityAfterMessage = useMemo(() => {
    const m = new Map<string, ActivityEvent[]>();
    for (const a of ACTIVITIES) {
      const arr = m.get(a.afterMessageId) ?? [];
      arr.push(a);
      m.set(a.afterMessageId, arr);
    }
    return m;
  }, []);

  return (
    <div className="relative">
      <div className="pr-[400px] transition-[padding] duration-300">
        <TicketHeader ticket={ticket} />
        <ActivityToggle
          activityOn={activityOn}
          onToggle={() => setActivityOn((v) => !v)}
        />

        {/* Click background → clear selection. Bubbles stopPropagation. */}
        <div
          className="mt-4 space-y-3"
          onClick={clearSelection}
        >
          {messages.map((msg) => {
            const cits = citationsByMessage.get(msg.id) ?? [];
            const isSelected = selectedId === msg.id;
            const isDimmed =
              mutedCitedIds !== null && !mutedCitedIds.has(msg.id);
            const activities = activityOn
              ? (activityAfterMessage.get(msg.id) ?? [])
              : [];
            return (
              <div key={msg.id}>
                <MessageBubble
                  message={msg}
                  citations={cits}
                  isSelected={isSelected}
                  isDimmed={isDimmed}
                  onSelect={() => selectMessage(msg.id)}
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
          {selected ? (
            <InspectPanel
              ticket={ticket}
              message={selected}
              citations={citationsByMessage.get(selected.id) ?? []}
              comments={commentsByMsg[selected.id] ?? []}
              relatedActivity={relatedActivity}
              activityOn={activityOn}
              addingCategory={addingCategory}
              changingScoreFor={changingScoreFor}
              pendingComment={pendingComment}
              onClose={clearSelection}
              onJumpCategory={(id) => {
                setSelectedId(null);
                setMutedCategoryId(id);
              }}
              onRemoveCitation={removeCitation}
              onSetScore={setCitationScore}
              onStartChangingScore={(catId) =>
                setChangingScoreFor((curr) => (curr === catId ? null : catId))
              }
              onStartAddCategory={() => setAddingCategory(true)}
              onCancelAddCategory={() => setAddingCategory(false)}
              onAddCitation={addCitation}
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
    </div>
  );
}

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
          Click any message to inspect it. Coaching, citations & comments move
          into the sidebar.
        </span>
      </div>
      <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <span>Show activity</span>
        <Switch checked={activityOn} onCheckedChange={onToggle} />
      </label>
    </div>
  );
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  return (
    <div
      className="flex items-center gap-3 py-1.5 text-sm text-muted-foreground animate-in fade-in duration-200"
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

function MessageBubble({
  message,
  citations,
  isSelected,
  isDimmed,
  onSelect,
}: {
  message: SampleMessage;
  citations: Citation[];
  isSelected: boolean;
  isDimmed: boolean;
  onSelect: () => void;
}) {
  const isAgent = message.role === "agent";

  return (
    <div
      className={cn(
        "flex gap-3 transition-all duration-300 ease-out",
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
          )}
        >
          {message.body}
        </button>

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
      </div>
    </div>
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

/* -------------------- Mode A: Overview -------------------- */

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
          <span>
            {category.highlightedMessageIds.length} cited
          </span>
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

/* -------------------- Mode B: Inspect -------------------- */

function InspectPanel({
  ticket,
  message,
  citations,
  comments,
  relatedActivity,
  activityOn,
  addingCategory,
  changingScoreFor,
  pendingComment,
  onClose,
  onJumpCategory,
  onRemoveCitation,
  onSetScore,
  onStartChangingScore,
  onStartAddCategory,
  onCancelAddCategory,
  onAddCitation,
  onPendingCommentChange,
  onSubmitComment,
}: {
  ticket: typeof sampleTicket;
  message: SampleMessage;
  citations: Citation[];
  comments: Comment[];
  relatedActivity: ActivityEvent[];
  activityOn: boolean;
  addingCategory: boolean;
  changingScoreFor: string | null;
  pendingComment: string;
  onClose: () => void;
  onJumpCategory: (id: string) => void;
  onRemoveCitation: (messageId: string, categoryId: string) => void;
  onSetScore: (messageId: string, categoryId: string, score: number) => void;
  onStartChangingScore: (categoryId: string) => void;
  onStartAddCategory: () => void;
  onCancelAddCategory: () => void;
  onAddCitation: (messageId: string, categoryId: string) => void;
  onPendingCommentChange: (s: string) => void;
  onSubmitComment: () => void;
}) {
  const { evaluation } = ticket;
  const isAgent = message.role === "agent";
  const availableCategories = evaluation.categories.filter(
    (c) => !citations.some((cit) => cit.categoryId === c.id),
  );

  return (
    <div
      className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-card/95 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-right-2 duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      <ScoresStrip
        evaluation={evaluation}
        onJump={onJumpCategory}
        onClose={onClose}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-5 p-4">
          {/* Selected message preview */}
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
                  <span className="ml-1 capitalize">
                    · {message.role}
                  </span>
                </span>
              </div>
              <p className="text-base text-foreground">{message.body}</p>
            </div>
          </section>

          {/* Citations */}
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
                    onRemove={() => onRemoveCitation(message.id, c.categoryId)}
                  />
                );
              })}

              {addingCategory ? (
                <CategoryPicker
                  categories={availableCategories}
                  onPick={(catId) => onAddCitation(message.id, catId)}
                  onCancel={onCancelAddCategory}
                />
              ) : (
                <button
                  type="button"
                  onClick={onStartAddCategory}
                  disabled={availableCategories.length === 0}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/40",
                    "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
                  )}
                >
                  <Plus className="size-3.5" />
                  {availableCategories.length === 0
                    ? "Cited under every category"
                    : "Add to category…"}
                </button>
              )}
            </div>
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
                Nothing here yet. Drop a note for {ticket.assignee.name.split(" ")[0]}?
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

function ScoresStrip({
  evaluation,
  onJump,
  onClose,
}: {
  evaluation: typeof sampleTicket.evaluation;
  onJump: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 border-b border-border bg-background/40 px-3 py-2">
      <div className="flex shrink-0 items-baseline gap-1 pr-1.5">
        <span className="text-base font-semibold text-foreground">
          {evaluation.overallScore}
        </span>
        <span className="text-sm text-muted-foreground">/100</span>
      </div>
      <div className="flex flex-1 items-center gap-1 overflow-x-auto">
        {evaluation.categories.map((cat) => (
          <ScorePill key={cat.id} category={cat} onClick={() => onJump(cat.id)} />
        ))}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Close inspect"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function ScorePill({
  category,
  onClick,
}: {
  category: SampleCategory;
  onClick: () => void;
}) {
  const hue = CATEGORY_HUE[category.id];
  const styles = HUE[hue];
  const label =
    category.scaleType === "binary"
      ? category.effectiveScore === 1
        ? "✓"
        : "✕"
      : `${category.effectiveScore}`;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${category.name} · ${
        category.scaleType === "binary"
          ? category.effectiveScore === 1
            ? "Pass"
            : "Fail"
          : `${category.effectiveScore}/5`
      }`}
      className={cn(
        "inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-full border px-2 text-sm font-medium transition-colors",
        styles.bgSoft,
        styles.borderSoft,
        styles.textDark,
        "hover:shadow-sm",
      )}
    >
      <span className={cn("size-1.5 rounded-full", styles.bg)} aria-hidden />
      <span className="tabular-nums">{label}</span>
    </button>
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
          className={cn(
            "shrink-0 text-sm tabular-nums",
            styles.textDark,
          )}
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

function CategoryPicker({
  categories,
  onPick,
  onCancel,
}: {
  categories: SampleCategory[];
  onPick: (catId: string) => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-background/40 p-2 animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="text-sm text-muted-foreground">Pick a category</span>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>
      <ul className="space-y-1">
        {categories.map((cat) => {
          const hue = CATEGORY_HUE[cat.id];
          const styles = HUE[hue];
          return (
            <li key={cat.id}>
              <button
                type="button"
                onClick={() => onPick(cat.id)}
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

