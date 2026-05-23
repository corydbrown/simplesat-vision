"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Minimize2,
  Sparkles,
  Star,
} from "lucide-react";
import {
  sampleTicket,
  type SampleCategory,
  type SampleMessage,
} from "@/lib/mockups/sample-data";
import { cn } from "@/lib/utils";

type Hue = "green" | "teal" | "yellow" | "red" | "grey";

function categoryHue(cat: SampleCategory): Hue {
  if (cat.scaleType === "binary") {
    return cat.effectiveScore === 1 ? "green" : "red";
  }
  if (cat.effectiveScore >= 5) return "green";
  if (cat.effectiveScore >= 4) return "teal";
  if (cat.effectiveScore >= 3) return "yellow";
  return "red";
}

const HUE: Record<
  Hue,
  {
    text: string;
    textDark: string;
    bg: string;
    bgSoft: string;
    border: string;
    ring: string;
    dot: string;
  }
> = {
  green: {
    text: "text-green-dark",
    textDark: "text-green-darker",
    bg: "bg-green",
    bgSoft: "bg-green-lighter",
    border: "border-green",
    ring: "ring-green",
    dot: "bg-green",
  },
  teal: {
    text: "text-teal-dark",
    textDark: "text-teal-darker",
    bg: "bg-teal",
    bgSoft: "bg-teal-lighter",
    border: "border-teal",
    ring: "ring-teal",
    dot: "bg-teal",
  },
  yellow: {
    text: "text-yellow-dark",
    textDark: "text-yellow-darker",
    bg: "bg-yellow",
    bgSoft: "bg-yellow-lighter",
    border: "border-yellow",
    ring: "ring-yellow",
    dot: "bg-yellow",
  },
  red: {
    text: "text-red-dark",
    textDark: "text-red-darker",
    bg: "bg-red",
    bgSoft: "bg-red-lighter",
    border: "border-red",
    ring: "ring-red",
    dot: "bg-red",
  },
  grey: {
    text: "text-grey-dark",
    textDark: "text-grey-darker",
    bg: "bg-grey",
    bgSoft: "bg-grey-lighter",
    border: "border-grey",
    ring: "ring-grey",
    dot: "bg-grey",
  },
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function OverlayMockupPage() {
  const ticket = sampleTicket;
  const { evaluation, messages } = ticket;

  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [coachingOpen, setCoachingOpen] = useState(false);

  const focusId = activeId ?? hoverId;
  const focusCategory = focusId
    ? (evaluation.categories.find((c) => c.id === focusId) ?? null)
    : null;

  const highlightedIds = useMemo(() => {
    if (!focusCategory) return null;
    return new Set(focusCategory.highlightedMessageIds);
  }, [focusCategory]);

  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!activeId) return;
    const cat = evaluation.categories.find((c) => c.id === activeId);
    const first = cat?.highlightedMessageIds[0];
    if (!first) return;
    const id = window.requestAnimationFrame(() => {
      messageRefs.current[first]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    return () => window.cancelAnimationFrame(id);
  }, [activeId, evaluation.categories]);

  const focusHue: Hue = focusCategory ? categoryHue(focusCategory) : "grey";
  const overlayActive = focusCategory !== null;

  return (
    <div className="relative">
      {/* Ambient tint when a category is in focus — sells the "lit up" feel */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none fixed inset-0 -z-10 transition-opacity duration-500",
          HUE[focusHue].bgSoft,
          overlayActive ? "opacity-25" : "opacity-0",
        )}
      />

      <div
        className={cn(
          "transition-[padding] duration-300",
          minimized ? "pr-20" : "pr-[360px]",
        )}
      >
        <TicketHeader ticket={ticket} />
        <div className="space-y-3">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isHighlighted={highlightedIds?.has(msg.id) ?? false}
              isDimmed={
                overlayActive && !(highlightedIds?.has(msg.id) ?? false)
              }
              focusHue={focusHue}
              focusCategoryName={focusCategory?.name ?? null}
              registerRef={(el) => {
                messageRefs.current[msg.id] = el;
              }}
            />
          ))}
        </div>
      </div>

      <aside
        className={cn(
          "absolute right-0 top-0 z-20 transition-[width] duration-300",
          minimized ? "w-14" : "w-[340px]",
        )}
      >
        <div className="sticky top-4">
          {minimized ? (
            <MinimizedPuck
              score={evaluation.overallScore}
              onClick={() => setMinimized(false)}
            />
          ) : (
            <FloatingPanel
              evaluation={evaluation}
              activeId={activeId}
              onSelect={(id) =>
                setActiveId((curr) => (curr === id ? null : id))
              }
              onHover={setHoverId}
              onMinimize={() => setMinimized(true)}
              coachingOpen={coachingOpen}
              onToggleCoaching={() => setCoachingOpen((v) => !v)}
            />
          )}
        </div>
      </aside>
    </div>
  );
}

function TicketHeader({ ticket }: { ticket: typeof sampleTicket }) {
  return (
    <header className="mb-6 space-y-3">
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

function MessageBubble({
  message,
  isHighlighted,
  isDimmed,
  focusHue,
  focusCategoryName,
  registerRef,
}: {
  message: SampleMessage;
  isHighlighted: boolean;
  isDimmed: boolean;
  focusHue: Hue;
  focusCategoryName: string | null;
  registerRef: (el: HTMLDivElement | null) => void;
}) {
  const isAgent = message.role === "agent";
  const hue = HUE[focusHue];

  return (
    <div
      ref={registerRef}
      className={cn(
        "flex scroll-mt-24 gap-3 transition-all duration-500 ease-out",
        isAgent ? "flex-row-reverse" : "flex-row",
        isDimmed && "opacity-30 blur-[0.5px]",
        isHighlighted && "scale-[1.01]",
      )}
    >
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors",
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
          "relative max-w-[78%] flex-1 space-y-1",
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
            "relative inline-block rounded-2xl border px-4 py-3 text-base text-left transition-all duration-500 ease-out",
            isAgent
              ? "rounded-tr-sm bg-primary/10 border-primary/20 text-foreground"
              : "rounded-tl-sm bg-card border-border text-foreground",
            isHighlighted &&
              cn(
                "ring-2 ring-offset-2 ring-offset-background shadow-lg",
                hue.ring,
                hue.bgSoft,
              ),
          )}
        >
          {isHighlighted && focusCategoryName && (
            <div
              className={cn(
                "absolute -top-3 z-10 flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm font-medium shadow-sm",
                "bg-background",
                hue.border,
                hue.textDark,
                isAgent ? "right-3" : "left-3",
                "animate-in fade-in slide-in-from-top-1 duration-300",
              )}
            >
              <Sparkles className="size-3" />
              Evidence — {focusCategoryName}
            </div>
          )}
          {message.body}
        </div>
      </div>
    </div>
  );
}

function MinimizedPuck({
  score,
  onClick,
}: {
  score: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex size-14 cursor-pointer items-center justify-center rounded-full",
        "bg-card/95 border-2 border-border shadow-xl backdrop-blur-md",
        "transition-all duration-300 hover:scale-110 hover:border-primary",
      )}
      aria-label="Expand QA panel"
    >
      <span className="text-base font-semibold text-foreground transition-colors group-hover:text-primary">
        {score}
      </span>
    </button>
  );
}

function FloatingPanel({
  evaluation,
  activeId,
  onSelect,
  onHover,
  onMinimize,
  coachingOpen,
  onToggleCoaching,
}: {
  evaluation: typeof sampleTicket.evaluation;
  activeId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onMinimize: () => void;
  coachingOpen: boolean;
  onToggleCoaching: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card/95 shadow-xl backdrop-blur-md",
        "animate-in fade-in slide-in-from-right-2 duration-300",
      )}
    >
      <PanelHeader
        score={evaluation.overallScore}
        confidence={evaluation.aiConfidence}
        onMinimize={onMinimize}
      />
      <div className="border-t border-border" />
      <div className="p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-sm font-medium text-muted-foreground">
            Categories
          </span>
          {activeId && (
            <button
              type="button"
              onClick={() => onSelect(activeId)}
              className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
        <ul className="space-y-1.5">
          {evaluation.categories.map((cat) => (
            <CategoryItem
              key={cat.id}
              category={cat}
              active={activeId === cat.id}
              dimmed={activeId !== null && activeId !== cat.id}
              onSelect={() => onSelect(cat.id)}
              onHover={onHover}
            />
          ))}
        </ul>
      </div>
      <div className="border-t border-border">
        <button
          type="button"
          onClick={onToggleCoaching}
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
        )}
      </div>
    </div>
  );
}

function PanelHeader({
  score,
  confidence,
  onMinimize,
}: {
  score: number;
  confidence: number;
  onMinimize: () => void;
}) {
  const scoreHue: Hue =
    score >= 90 ? "green" : score >= 75 ? "teal" : score >= 60 ? "yellow" : "red";
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="relative">
        <ScoreRing value={score} hue={scoreHue} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-muted-foreground">QA evaluation</div>
        <div className="text-base font-medium text-foreground">
          AI scored · {confidence}% confidence
        </div>
      </div>
      <button
        type="button"
        onClick={onMinimize}
        className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Minimize panel"
      >
        <Minimize2 className="size-4" />
      </button>
    </div>
  );
}

function ScoreRing({ value, hue }: { value: number; hue: Hue }) {
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (value / 100) * circumference;
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
          {
            "stroke-green": hue === "green",
            "stroke-teal": hue === "teal",
            "stroke-yellow": hue === "yellow",
            "stroke-red": hue === "red",
            "stroke-grey": hue === "grey",
          },
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

function CategoryItem({
  category,
  active,
  dimmed,
  onSelect,
  onHover,
}: {
  category: SampleCategory;
  active: boolean;
  dimmed: boolean;
  onSelect: () => void;
  onHover: (id: string | null) => void;
}) {
  const hue = categoryHue(category);
  const styles = HUE[hue];
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        onMouseEnter={() => onHover(category.id)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(category.id)}
        onBlur={() => onHover(null)}
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
          <span className="truncate">
            {category.highlightedMessageIds.length} message
            {category.highlightedMessageIds.length === 1 ? "" : "s"}
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
