"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronDown, ChevronUp, Sparkles, Star, X } from "lucide-react";
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
    bgSofter: string;
    border: string;
    borderSoft: string;
    ring: string;
    dot: string;
    stroke: string;
  }
> = {
  blue: {
    text: "text-blue-dark",
    textDark: "text-blue-darker",
    bg: "bg-blue",
    bgSoft: "bg-blue-lighter",
    bgSofter: "bg-blue-lighter/60",
    border: "border-blue",
    borderSoft: "border-blue-light",
    ring: "ring-blue",
    dot: "bg-blue",
    stroke: "stroke-blue",
  },
  green: {
    text: "text-green-dark",
    textDark: "text-green-darker",
    bg: "bg-green",
    bgSoft: "bg-green-lighter",
    bgSofter: "bg-green-lighter/60",
    border: "border-green",
    borderSoft: "border-green-light",
    ring: "ring-green",
    dot: "bg-green",
    stroke: "stroke-green",
  },
  yellow: {
    text: "text-yellow-dark",
    textDark: "text-yellow-darker",
    bg: "bg-yellow",
    bgSoft: "bg-yellow-lighter",
    bgSofter: "bg-yellow-lighter/60",
    border: "border-yellow",
    borderSoft: "border-yellow-light",
    ring: "ring-yellow",
    dot: "bg-yellow",
    stroke: "stroke-yellow",
  },
  purple: {
    text: "text-purple-dark",
    textDark: "text-purple-darker",
    bg: "bg-purple",
    bgSoft: "bg-purple-lighter",
    bgSofter: "bg-purple-lighter/60",
    border: "border-purple",
    borderSoft: "border-purple-light",
    ring: "ring-purple",
    dot: "bg-purple",
    stroke: "stroke-purple",
  },
  teal: {
    text: "text-teal-dark",
    textDark: "text-teal-darker",
    bg: "bg-teal",
    bgSoft: "bg-teal-lighter",
    bgSofter: "bg-teal-lighter/60",
    border: "border-teal",
    borderSoft: "border-teal-light",
    ring: "ring-teal",
    dot: "bg-teal",
    stroke: "stroke-teal",
  },
};

type Citation = {
  /** Stable per (msg, cat) — used as draggable id for tabs. */
  key: string;
  messageId: string;
  categoryId: string;
  aiSuggested: boolean;
};

function buildInitialCitations(categories: SampleCategory[]): Citation[] {
  const out: Citation[] = [];
  for (const cat of categories) {
    for (const msgId of cat.highlightedMessageIds) {
      out.push({
        key: `${msgId}::${cat.id}`,
        messageId: msgId,
        categoryId: cat.id,
        aiSuggested: true,
      });
    }
  }
  return out;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

const MSG_DRAG_PREFIX = "msg:";
const TAB_DRAG_PREFIX = "tab:";
const CAT_DROP_PREFIX = "cat:";

export default function DragCiteMockupPage() {
  const ticket = sampleTicket;
  const { evaluation, messages } = ticket;

  const [citations, setCitations] = useState<Citation[]>(() =>
    buildInitialCitations(evaluation.categories),
  );
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [hoverCategoryId, setHoverCategoryId] = useState<string | null>(null);
  const [pulseCategoryId, setPulseCategoryId] = useState<string | null>(null);
  const [coachingOpen, setCoachingOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  /** Map: messageId -> citations on that message */
  const citationsByMessage = useMemo(() => {
    const m = new Map<string, Citation[]>();
    for (const c of citations) {
      const arr = m.get(c.messageId) ?? [];
      arr.push(c);
      m.set(c.messageId, arr);
    }
    return m;
  }, [citations]);

  /** Map: categoryId -> citations for that category */
  const citationsByCategory = useMemo(() => {
    const m = new Map<string, Citation[]>();
    for (const c of citations) {
      const arr = m.get(c.categoryId) ?? [];
      arr.push(c);
      m.set(c.categoryId, arr);
    }
    return m;
  }, [citations]);

  const baseCountByCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const cat of evaluation.categories) {
      m.set(cat.id, cat.highlightedMessageIds.length);
    }
    return m;
  }, [evaluation.categories]);

  function getCategoryDelta(catId: string) {
    const base = baseCountByCategory.get(catId) ?? 0;
    const curr = citationsByCategory.get(catId)?.length ?? 0;
    return curr - base;
  }

  function getEffectiveScore(cat: SampleCategory) {
    const delta = getCategoryDelta(cat.id);
    if (cat.scaleType === "binary") {
      // Binary: scoring doesn't move with citations — but we'll show the delta on the count.
      return cat.effectiveScore;
    }
    const next = cat.effectiveScore + delta * 0.5;
    return Math.max(1, Math.min(5, next));
  }

  function pulse(catId: string) {
    setPulseCategoryId(catId);
    window.setTimeout(() => {
      setPulseCategoryId((curr) => (curr === catId ? null : curr));
    }, 700);
  }

  function addCitation(messageId: string, categoryId: string) {
    setCitations((prev) => {
      if (prev.some((c) => c.messageId === messageId && c.categoryId === categoryId)) {
        return prev;
      }
      return [
        ...prev,
        {
          key: `${messageId}::${categoryId}`,
          messageId,
          categoryId,
          aiSuggested: false,
        },
      ];
    });
    pulse(categoryId);
  }

  function removeCitation(messageId: string, categoryId: string) {
    setCitations((prev) =>
      prev.filter(
        (c) => !(c.messageId === messageId && c.categoryId === categoryId),
      ),
    );
    pulse(categoryId);
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveDragId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    setActiveDragId(null);

    // Drop a message bubble onto a category card → add citation.
    if (activeId.startsWith(MSG_DRAG_PREFIX) && overId?.startsWith(CAT_DROP_PREFIX)) {
      const messageId = activeId.slice(MSG_DRAG_PREFIX.length);
      const categoryId = overId.slice(CAT_DROP_PREFIX.length);
      addCitation(messageId, categoryId);
      return;
    }

    // Drag a tab off its bubble onto anything other than its own category → remove citation.
    if (activeId.startsWith(TAB_DRAG_PREFIX)) {
      const [, messageId, categoryId] = activeId.split(":");
      if (!messageId || !categoryId) return;
      const overCat =
        overId?.startsWith(CAT_DROP_PREFIX) && overId.slice(CAT_DROP_PREFIX.length);

      if (overCat && overCat !== categoryId) {
        // Tab moved from one category to a different category card → reassign.
        removeCitation(messageId, categoryId);
        addCitation(messageId, overCat);
        return;
      }
      if (!overCat) {
        // Dropped on empty space → remove.
        removeCitation(messageId, categoryId);
      }
    }
  }

  const activeMessageForOverlay = (() => {
    if (!activeDragId?.startsWith(MSG_DRAG_PREFIX)) return null;
    const id = activeDragId.slice(MSG_DRAG_PREFIX.length);
    return messages.find((m) => m.id === id) ?? null;
  })();

  const activeTabForOverlay = (() => {
    if (!activeDragId?.startsWith(TAB_DRAG_PREFIX)) return null;
    const [, , categoryId] = activeDragId.split(":");
    if (!categoryId) return null;
    const cat = evaluation.categories.find((c) => c.id === categoryId);
    return cat ?? null;
  })();

  const highlightedMessageIds = useMemo(() => {
    if (!hoverCategoryId) return null;
    return new Set(
      (citationsByCategory.get(hoverCategoryId) ?? []).map((c) => c.messageId),
    );
  }, [citationsByCategory, hoverCategoryId]);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="relative">
        <div className="pr-[380px] transition-[padding] duration-300">
          <TicketHeader ticket={ticket} />
          <DragHint />
          <div className="mt-4 space-y-3">
            {messages.map((msg) => (
              <DraggableMessageBubble
                key={msg.id}
                message={msg}
                citations={citationsByMessage.get(msg.id) ?? []}
                hoverCategoryId={hoverCategoryId}
                isHighlighted={highlightedMessageIds?.has(msg.id) ?? false}
                onRemoveCitation={removeCitation}
              />
            ))}
          </div>
        </div>

        <aside className="absolute right-0 top-0 z-20 w-[360px]">
          <div className="sticky top-4 space-y-3">
            <FloatingPanelHeader
              score={evaluation.overallScore}
              confidence={evaluation.aiConfidence}
            />
            <div className="rounded-xl border border-border bg-card/95 shadow-xl backdrop-blur-md">
              <div className="px-4 pt-4 pb-2 text-sm font-medium text-muted-foreground">
                Categories — drag a message in to cite
              </div>
              <ul className="space-y-2 px-3 pb-3">
                {evaluation.categories.map((cat) => (
                  <DroppableCategoryCard
                    key={cat.id}
                    category={cat}
                    citations={citationsByCategory.get(cat.id) ?? []}
                    delta={getCategoryDelta(cat.id)}
                    effectiveScore={getEffectiveScore(cat)}
                    isPulsing={pulseCategoryId === cat.id}
                    onHover={setHoverCategoryId}
                  />
                ))}
              </ul>
              <div className="border-t border-border">
                <button
                  type="button"
                  onClick={() => setCoachingOpen((v) => !v)}
                  className="flex w-full cursor-pointer items-center justify-between px-4 py-2.5 text-base font-medium text-foreground transition-colors hover:bg-accent/50"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    Coaching
                  </span>
                  {coachingOpen ? (
                    <ChevronUp className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  )}
                </button>
                {coachingOpen && (
                  <CoachingBlock evaluation={evaluation} />
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeMessageForOverlay && (
          <MessageGhost message={activeMessageForOverlay} />
        )}
        {activeTabForOverlay && (
          <TabGhost category={activeTabForOverlay} />
        )}
      </DragOverlay>
    </DndContext>
  );
}

function TicketHeader({ ticket }: { ticket: typeof sampleTicket }) {
  return (
    <header className="mb-3 space-y-3">
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

function DragHint() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-card/40 px-3 py-2 text-sm text-muted-foreground">
      <Sparkles className="size-4 text-primary" />
      <span>
        AI pre-cited evidence for each category. Drag any message onto a category
        to add a citation — drag a tag off to remove.
      </span>
    </div>
  );
}

function DraggableMessageBubble({
  message,
  citations,
  hoverCategoryId,
  isHighlighted,
  onRemoveCitation,
}: {
  message: SampleMessage;
  citations: Citation[];
  hoverCategoryId: string | null;
  isHighlighted: boolean;
  onRemoveCitation: (messageId: string, categoryId: string) => void;
}) {
  const isAgent = message.role === "agent";
  const draggable = useDraggable({ id: `${MSG_DRAG_PREFIX}${message.id}` });
  const { setNodeRef, listeners, attributes, isDragging, transform } =
    draggable;

  const haloHue: Hue | null = hoverCategoryId
    ? (CATEGORY_HUE[hoverCategoryId] ?? null)
    : null;
  const halo = haloHue ? HUE[haloHue] : null;

  const transformStyle = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      className={cn(
        "flex gap-3 transition-all duration-300 ease-out",
        isAgent ? "flex-row-reverse" : "flex-row",
        isDragging && "opacity-30",
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
          ref={setNodeRef}
          style={transformStyle}
          {...listeners}
          {...attributes}
          className={cn(
            "relative inline-block cursor-grab touch-none select-none rounded-2xl border px-4 py-3 text-left text-base transition-all duration-300 ease-out",
            "active:cursor-grabbing",
            isAgent
              ? "rounded-tr-sm border-primary/20 bg-primary/10 text-foreground"
              : "rounded-tl-sm border-border bg-card text-foreground",
            "hover:-translate-y-px hover:shadow-md",
            isHighlighted &&
              halo &&
              cn(
                "ring-2 ring-offset-2 ring-offset-background shadow-lg",
                halo.ring,
                halo.bgSoft,
              ),
          )}
          aria-label={`Drag ${message.authorName}'s message to cite it`}
        >
          {message.body}
        </div>

        {citations.length > 0 && (
          <div
            className={cn(
              "flex flex-wrap gap-1.5 pt-1",
              isAgent ? "justify-end" : "justify-start",
            )}
          >
            {citations.map((c) => (
              <CitationTab
                key={c.key}
                citation={c}
                onRemove={() => onRemoveCitation(c.messageId, c.categoryId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CitationTab({
  citation,
  onRemove,
}: {
  citation: Citation;
  onRemove: () => void;
}) {
  const hue = CATEGORY_HUE[citation.categoryId];
  const styles = HUE[hue];
  const category = sampleTicket.evaluation.categories.find(
    (c) => c.id === citation.categoryId,
  );

  const dragId = `${TAB_DRAG_PREFIX}${citation.messageId}:${citation.categoryId}`;
  const { setNodeRef, listeners, attributes, isDragging, transform } =
    useDraggable({ id: dragId });

  const transformStyle = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <span
      ref={setNodeRef}
      style={transformStyle}
      {...listeners}
      {...attributes}
      className={cn(
        "inline-flex cursor-grab touch-none select-none items-center gap-1 rounded-full border px-2 py-0.5 text-sm font-medium shadow-sm transition-all",
        "active:cursor-grabbing hover:-translate-y-px hover:shadow-md",
        styles.bgSoft,
        styles.borderSoft,
        styles.textDark,
        isDragging && "opacity-30",
      )}
      title={`Cited under "${category?.name}". Drag off to remove.`}
    >
      <span className={cn("size-1.5 rounded-full", styles.bg)} aria-hidden />
      <span>{category?.name ?? citation.categoryId}</span>
      {citation.aiSuggested && (
        <Sparkles className="size-3 opacity-80" aria-label="AI suggested" />
      )}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className={cn(
          "ml-0.5 -mr-0.5 cursor-pointer rounded-full p-0.5 transition-colors",
          "hover:bg-background/70",
        )}
        aria-label={`Remove ${category?.name} citation`}
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

function DroppableCategoryCard({
  category,
  citations,
  delta,
  effectiveScore,
  isPulsing,
  onHover,
}: {
  category: SampleCategory;
  citations: Citation[];
  delta: number;
  effectiveScore: number;
  isPulsing: boolean;
  onHover: (id: string | null) => void;
}) {
  const hue = CATEGORY_HUE[category.id];
  const styles = HUE[hue];
  const dropId = `${CAT_DROP_PREFIX}${category.id}`;
  const { setNodeRef, isOver, active } = useDroppable({ id: dropId });

  // Only show "active dropzone" affordance when something draggable is in flight.
  const dropActive = active !== null;

  return (
    <li>
      <div
        ref={setNodeRef}
        onMouseEnter={() => onHover(category.id)}
        onMouseLeave={() => onHover(null)}
        className={cn(
          "group relative overflow-hidden rounded-lg border px-3 py-2.5 transition-all duration-200",
          dropActive
            ? cn("border-dashed", styles.borderSoft, styles.bgSofter)
            : "border-border bg-transparent hover:bg-accent/30",
          isOver &&
            cn(
              "border-solid shadow-md scale-[1.02]",
              styles.border,
              styles.bgSoft,
            ),
          isPulsing && cn("animate-pulse", styles.bgSoft, styles.border),
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-2 left-0 w-1 rounded-r-full transition-all duration-200",
            styles.bg,
            isOver || isPulsing
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-60",
          )}
        />
        <div className="flex items-start justify-between gap-2 pl-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span
                className={cn("text-base font-medium text-foreground")}
              >
                {category.name}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
              <span>{category.weightPercent}% weight</span>
              {category.isAutofail && (
                <>
                  <span aria-hidden>·</span>
                  <span className="font-medium text-red-darker">Autofail</span>
                </>
              )}
              <span aria-hidden>·</span>
              <span>
                {citations.length} cited
                {delta !== 0 && (
                  <span
                    className={cn(
                      "ml-1 font-medium",
                      delta > 0 ? styles.textDark : "text-muted-foreground",
                    )}
                  >
                    ({delta > 0 ? "+" : ""}
                    {delta})
                  </span>
                )}
              </span>
            </div>
          </div>
          <ScoreBadge
            category={category}
            hue={hue}
            effectiveScore={effectiveScore}
            delta={delta}
          />
        </div>
      </div>
    </li>
  );
}

function ScoreBadge({
  category,
  hue,
  effectiveScore,
  delta,
}: {
  category: SampleCategory;
  hue: Hue;
  effectiveScore: number;
  delta: number;
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
  const filled = Math.round(effectiveScore);
  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5">
      <span className="flex items-center gap-0.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={cn(
              "size-3 transition-colors",
              n <= filled
                ? cn(styles.text, "fill-current")
                : "text-border",
            )}
          />
        ))}
      </span>
      <span
        className={cn(
          "text-sm tabular-nums transition-colors",
          delta !== 0 ? styles.textDark : "text-muted-foreground",
        )}
      >
        {effectiveScore.toFixed(1)}
      </span>
    </div>
  );
}

function MessageGhost({ message }: { message: SampleMessage }) {
  const isAgent = message.role === "agent";
  return (
    <div
      className={cn(
        "max-w-[420px] cursor-grabbing rounded-2xl border px-4 py-3 text-base shadow-2xl rotate-[-1.5deg]",
        isAgent
          ? "rounded-tr-sm border-primary/30 bg-primary/15 text-foreground"
          : "rounded-tl-sm border-border bg-card text-foreground",
      )}
    >
      <div className="mb-1 text-sm font-medium text-foreground/80">
        {message.authorName}
      </div>
      <div className="line-clamp-3">{message.body}</div>
    </div>
  );
}

function TabGhost({ category }: { category: SampleCategory }) {
  const hue = CATEGORY_HUE[category.id];
  const styles = HUE[hue];
  return (
    <span
      className={cn(
        "inline-flex cursor-grabbing items-center gap-1 rounded-full border px-2 py-0.5 text-sm font-medium shadow-xl rotate-[-2deg]",
        styles.bgSoft,
        styles.borderSoft,
        styles.textDark,
      )}
    >
      <span className={cn("size-1.5 rounded-full", styles.bg)} aria-hidden />
      <span>{category.name}</span>
    </span>
  );
}

function FloatingPanelHeader({
  score,
  confidence,
}: {
  score: number;
  confidence: number;
}) {
  const scoreHue: Hue =
    score >= 90 ? "green" : score >= 75 ? "teal" : score >= 60 ? "yellow" : "purple";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur-md">
      <ScoreRing value={score} hue={scoreHue} />
      <div className="min-w-0 flex-1">
        <div className="text-sm text-muted-foreground">QA evaluation</div>
        <div className="text-base font-medium text-foreground">
          AI scored · {confidence}% confidence
        </div>
      </div>
    </div>
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
        className={cn("transition-[stroke-dashoffset] duration-700 ease-out", styles.stroke)}
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

function CoachingBlock({
  evaluation,
}: {
  evaluation: typeof sampleTicket.evaluation;
}) {
  return (
    <div className="space-y-3 px-4 pb-4 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
      <div>
        <div className="mb-1 text-sm font-medium text-green-darker">
          Strengths
        </div>
        <ul className="space-y-1 text-base text-muted-foreground">
          {evaluation.coaching.strengthPoints.map((p) => (
            <li key={p} className="flex gap-1.5">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-green" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="mb-1 text-sm font-medium text-yellow-darker">
          Growth areas
        </div>
        <ul className="space-y-1 text-base text-muted-foreground">
          {evaluation.coaching.growthPoints.map((p) => (
            <li key={p} className="flex gap-1.5">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-yellow" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
