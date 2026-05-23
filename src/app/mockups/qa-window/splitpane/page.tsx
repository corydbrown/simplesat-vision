"use client";

/** Split-pane QA review mode.
 *  Conversation left, scoring right. Clicking a category scrolls + highlights
 *  the supporting messages on the left so the evidence ↔ score connection
 *  reads as a single glance. Pure mockup — no DB, no production imports. */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  ArrowRight,
  ChevronLeft,
  CornerDownLeft,
  MessageSquare,
  Sparkles,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Kbd } from "@/components/ui/kbd";
import {
  sampleTicket,
  type SampleCategory,
} from "@/lib/mockups/sample-data";
import { formatSmartTime, formatDuration } from "@/lib/format";

type Override = { score: number; reason: string };

const SESSION_QUEUE_POSITION = 3;
const SESSION_QUEUE_LENGTH = 50;

export default function QaSplitpanePage() {
  const ticket = sampleTicket;
  const { evaluation } = ticket;

  const [activeCategoryId, setActiveCategoryId] = useState<string>(
    evaluation.categories[0].id,
  );
  const [overrides, setOverrides] = useState<Record<string, Override>>({});

  const activeCategory = useMemo(
    () => evaluation.categories.find((c) => c.id === activeCategoryId)!,
    [activeCategoryId, evaluation.categories],
  );

  const highlightedSet = useMemo(
    () => new Set(activeCategory.highlightedMessageIds),
    [activeCategory],
  );

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Scroll the active category's first supporting message into the visible
  // band of the left pane. Manual math (not scrollIntoView) so the outer
  // page never scrolls, only the conversation container.
  useEffect(() => {
    const container = scrollContainerRef.current;
    const firstId = activeCategory.highlightedMessageIds[0];
    const el = firstId ? messageRefs.current[firstId] : null;
    if (!container || !el) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const target =
      container.scrollTop +
      (elRect.top - containerRect.top) -
      containerRect.height / 2 +
      elRect.height / 2;
    container.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  }, [activeCategory]);

  const setOverride = useCallback(
    (categoryId: string, partial: Partial<Override>) => {
      setOverrides((prev) => {
        const cat = evaluation.categories.find((c) => c.id === categoryId);
        const existing = prev[categoryId] ?? {
          score: cat?.aiScore ?? 0,
          reason: "",
        };
        return { ...prev, [categoryId]: { ...existing, ...partial } };
      });
    },
    [evaluation.categories],
  );

  const clearOverride = useCallback((categoryId: string) => {
    setOverrides((prev) => {
      if (!prev[categoryId]) return prev;
      const next = { ...prev };
      delete next[categoryId];
      return next;
    });
  }, []);

  const moveCategory = useCallback(
    (direction: 1 | -1) => {
      const idx = evaluation.categories.findIndex(
        (c) => c.id === activeCategoryId,
      );
      const next =
        (idx + direction + evaluation.categories.length) %
        evaluation.categories.length;
      setActiveCategoryId(evaluation.categories[next].id);
    },
    [activeCategoryId, evaluation.categories],
  );

  // Global shortcuts: 1-5 score active category, j/k move between categories,
  // [/] move ticket queue, a approve & next. Ignored while typing in inputs.
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLInputElement
      )
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        moveCategory(1);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        moveCategory(-1);
      } else if (/^[1-5]$/.test(e.key)) {
        const n = parseInt(e.key, 10);
        if (
          activeCategory.scaleType === "binary" &&
          (n === 1 || n === 0)
        ) {
          setOverride(activeCategoryId, { score: n });
        } else if (activeCategory.scaleType === "likert_5") {
          setOverride(activeCategoryId, { score: n });
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeCategoryId, activeCategory, moveCategory, setOverride]);

  const weightedTotal = useMemo(() => {
    let total = 0;
    let weight = 0;
    for (const cat of evaluation.categories) {
      const override = overrides[cat.id];
      const raw = override ? override.score : cat.aiScore;
      const max = cat.scaleType === "binary" ? 1 : 5;
      total += (raw / max) * cat.weightPercent;
      weight += cat.weightPercent;
    }
    return weight === 0 ? 0 : Math.round((total / weight) * 100);
  }, [evaluation.categories, overrides]);

  const hasOverrides = Object.keys(overrides).length > 0;

  return (
    <div className="space-y-3">
      <SessionHeader
        ticket={ticket}
        liveScore={weightedTotal}
        baselineScore={evaluation.overallScore}
        hasOverrides={hasOverrides}
      />

      <div className="grid h-[calc(100vh-220px)] min-h-[560px] grid-cols-[minmax(0,1fr)_440px] gap-3">
        <ConversationPane
          ticket={ticket}
          highlightedSet={highlightedSet}
          activeCategory={activeCategory}
          scrollContainerRef={scrollContainerRef}
          messageRefs={messageRefs}
        />

        <ScorePane
          evaluation={evaluation}
          activeCategoryId={activeCategoryId}
          setActiveCategoryId={setActiveCategoryId}
          overrides={overrides}
          setOverride={setOverride}
          clearOverride={clearOverride}
        />
      </div>

      <ShortcutBar />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Session header

function SessionHeader({
  ticket,
  liveScore,
  baselineScore,
  hasOverrides,
}: {
  ticket: typeof sampleTicket;
  liveScore: number;
  baselineScore: number;
  hasOverrides: boolean;
}) {
  return (
    <header className="flex items-center gap-4 rounded-lg border border-border bg-card px-5 py-3">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded-md bg-grey-lighter px-1.5 py-0.5 text-sm font-medium text-grey-darker">
            {ticket.externalId}
          </span>
          <StatusPill status={ticket.status} />
          <PriorityPill priority={ticket.priority} />
          <ChannelPill channel={ticket.channel} />
          <TierPill tier={ticket.customer.tier} />
        </div>
        <h1 className="truncate text-base font-semibold text-foreground">
          {ticket.subject}
        </h1>
        <div className="mt-0.5 text-sm text-muted-foreground">
          {ticket.customer.name} · handled by {ticket.assignee.name} ·{" "}
          {formatDuration(
            new Date(ticket.createdAt),
            new Date(ticket.solvedAt ?? ticket.createdAt),
          )}{" "}
          to resolution · solved{" "}
          {formatSmartTime(
            ticket.solvedAt ? new Date(ticket.solvedAt) : null,
          )}
        </div>
      </div>

      <ScoreDial score={liveScore} baseline={baselineScore} drift={hasOverrides} />

      <div className="flex flex-col items-end gap-1.5">
        <div className="text-sm text-muted-foreground">
          Ticket{" "}
          <span className="font-medium text-foreground">
            {SESSION_QUEUE_POSITION}
          </span>{" "}
          of {SESSION_QUEUE_LENGTH}
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="cursor-pointer">
            <ChevronLeft className="size-4" />
            Prev
          </Button>
          <Button size="sm" className="cursor-pointer">
            Approve & next
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}

function ScoreDial({
  score,
  baseline,
  drift,
}: {
  score: number;
  baseline: number;
  drift: boolean;
}) {
  const tone =
    score >= 85
      ? "green"
      : score >= 70
        ? "yellow"
        : "red";
  const toneClasses: Record<typeof tone, string> = {
    green: "bg-green-lighter text-green-darker",
    yellow: "bg-yellow-lighter text-yellow-darker",
    red: "bg-red-lighter text-red-darker",
  };
  return (
    <div className="flex items-center gap-3 rounded-md border border-border px-3 py-1.5">
      <div className="text-sm text-muted-foreground">Overall</div>
      <div
        className={cn(
          "rounded-md px-2.5 py-1 text-base font-semibold tabular-nums",
          toneClasses[tone],
        )}
      >
        {score}
      </div>
      {drift && (
        <div className="text-sm text-muted-foreground tabular-nums">
          was {baseline}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Stateful pills (inline — mockup is not allowed to import shared/ pills)

function StatusPill({ status }: { status: typeof sampleTicket.status }) {
  const tone: Record<typeof status, string> = {
    open: "bg-blue-lighter text-blue-darker",
    pending: "bg-yellow-lighter text-yellow-darker",
    solved: "bg-green-lighter text-green-darker",
    closed: "bg-grey-lighter text-grey-darker",
  };
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 text-sm font-medium capitalize",
        tone[status],
      )}
    >
      {status}
    </span>
  );
}

function PriorityPill({
  priority,
}: {
  priority: typeof sampleTicket.priority;
}) {
  const tone: Record<typeof priority, string> = {
    low: "bg-grey-lighter text-grey-darker",
    normal: "bg-blue-lighter text-blue-darker",
    high: "bg-yellow-lighter text-yellow-darker",
    urgent: "bg-red-lighter text-red-darker",
  };
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 text-sm font-medium capitalize",
        tone[priority],
      )}
    >
      {priority}
    </span>
  );
}

function ChannelPill({ channel }: { channel: typeof sampleTicket.channel }) {
  return (
    <span className="rounded-md bg-purple-lighter px-2 py-0.5 text-sm font-medium capitalize text-purple-darker">
      {channel}
    </span>
  );
}

function TierPill({ tier }: { tier: typeof sampleTicket.customer.tier }) {
  const tone: Record<typeof tier, string> = {
    insider: "bg-grey-lighter text-grey-darker",
    gold: "bg-yellow-lighter text-yellow-darker",
    elite: "bg-purple-lighter text-purple-darker",
  };
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 text-sm font-medium capitalize",
        tone[tier],
      )}
    >
      {tier}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Left pane — conversation

function ConversationPane({
  ticket,
  highlightedSet,
  activeCategory,
  scrollContainerRef,
  messageRefs,
}: {
  ticket: typeof sampleTicket;
  highlightedSet: Set<string>;
  activeCategory: SampleCategory;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  messageRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-2.5 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MessageSquare className="size-4" />
          <span>
            Conversation ·{" "}
            <span className="text-foreground">
              {ticket.messages.length} messages
            </span>
          </span>
        </div>
        <div className="text-muted-foreground">
          Evidence for{" "}
          <span className="font-medium text-foreground">
            {activeCategory.name}
          </span>{" "}
          highlighted
        </div>
      </div>
      <div
        ref={scrollContainerRef}
        className="flex-1 space-y-3 overflow-y-auto px-5 py-4"
      >
        {ticket.messages.map((m) => {
          const isHighlighted = highlightedSet.has(m.id);
          const isAgent = m.role === "agent";
          return (
            <div
              key={m.id}
              ref={(el) => {
                messageRefs.current[m.id] = el;
              }}
              className={cn(
                "rounded-md border px-4 py-3 transition-colors",
                isAgent
                  ? "border-border bg-background"
                  : "border-border bg-grey-lighter",
                isHighlighted &&
                  "border-yellow ring-2 ring-yellow/40 bg-yellow-lighter",
              )}
            >
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Avatar
                    name={m.authorName}
                    color={isAgent ? ticket.assignee.avatarColor : "#0EA5A4"}
                  />
                  <div className="text-base font-medium text-foreground">
                    {m.authorName}
                  </div>
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-sm font-medium capitalize",
                      isAgent
                        ? "bg-blue-lighter text-blue-darker"
                        : "bg-grey-lighter text-grey-darker",
                    )}
                  >
                    {m.role}
                  </span>
                  {isHighlighted && (
                    <span className="rounded-md bg-yellow px-1.5 py-0.5 text-sm font-medium text-yellow-darker">
                      Cited
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatSmartTime(new Date(m.createdAt))}
                </div>
              </div>
              <div className="text-base leading-relaxed text-foreground">
                {m.body}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Avatar({ name, color }: { name: string; color: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      className="flex size-6 items-center justify-center rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Right pane — scoring

function ScorePane({
  evaluation,
  activeCategoryId,
  setActiveCategoryId,
  overrides,
  setOverride,
  clearOverride,
}: {
  evaluation: typeof sampleTicket.evaluation;
  activeCategoryId: string;
  setActiveCategoryId: (id: string) => void;
  overrides: Record<string, Override>;
  setOverride: (id: string, partial: Partial<Override>) => void;
  clearOverride: (id: string) => void;
}) {
  const activeCategory = evaluation.categories.find(
    (c) => c.id === activeCategoryId,
  )!;
  const override = overrides[activeCategoryId];

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="size-4 text-purple" />
          <span>
            Scored by{" "}
            <span className="text-foreground">
              {evaluation.scorer.displayName}
            </span>
          </span>
        </div>
        <div className="text-muted-foreground tabular-nums">
          {evaluation.aiConfidence}% confidence
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <ol className="divide-y divide-border">
          {evaluation.categories.map((cat) => {
            const override = overrides[cat.id];
            const isActive = cat.id === activeCategoryId;
            const isEdited = !!override;
            const score = override?.score ?? cat.aiScore;
            const max = cat.scaleType === "binary" ? 1 : 5;
            return (
              <li key={cat.id}>
                <button
                  type="button"
                  onClick={() => setActiveCategoryId(cat.id)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors",
                    "hover:bg-accent/40",
                    isActive && "bg-blue-lighter/60",
                  )}
                  aria-pressed={isActive}
                >
                  <div
                    aria-hidden
                    className={cn(
                      "h-8 w-1 shrink-0 rounded-full",
                      isActive ? "bg-blue" : "bg-transparent",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-base font-medium text-foreground">
                        {cat.name}
                      </span>
                      {cat.isAutofail && (
                        <span className="rounded-md bg-red-lighter px-1.5 py-0.5 text-sm font-medium text-red-darker">
                          Auto-fail
                        </span>
                      )}
                      {isEdited && (
                        <span className="rounded-md bg-purple-lighter px-1.5 py-0.5 text-sm font-medium text-purple-darker">
                          Edited
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Weighted {cat.weightPercent}% · {cat.highlightedMessageIds.length}{" "}
                      {cat.highlightedMessageIds.length === 1 ? "citation" : "citations"}
                    </div>
                  </div>
                  <ScoreBadge
                    score={score}
                    max={max}
                    scaleType={cat.scaleType}
                    drift={isEdited && override.score !== cat.aiScore}
                  />
                </button>
              </li>
            );
          })}
        </ol>

        <div className="flex min-h-0 flex-1 flex-col border-t border-border bg-grey-lighter/40">
          <CategoryDetail
            category={activeCategory}
            override={override}
            setOverride={(partial) => setOverride(activeCategoryId, partial)}
            clearOverride={() => clearOverride(activeCategoryId)}
          />
        </div>
      </div>
    </aside>
  );
}

function ScoreBadge({
  score,
  max,
  scaleType,
  drift,
}: {
  score: number;
  max: number;
  scaleType: SampleCategory["scaleType"];
  drift: boolean;
}) {
  const tone =
    scaleType === "binary"
      ? score >= 1
        ? "green"
        : "red"
      : score >= 4
        ? "green"
        : score >= 3
          ? "yellow"
          : "red";
  const toneClasses: Record<typeof tone, string> = {
    green: "bg-green-lighter text-green-darker",
    yellow: "bg-yellow-lighter text-yellow-darker",
    red: "bg-red-lighter text-red-darker",
  };
  const label =
    scaleType === "binary" ? (score >= 1 ? "Pass" : "Fail") : `${score}/${max}`;
  return (
    <span
      className={cn(
        "shrink-0 rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums",
        toneClasses[tone],
        drift && "ring-2 ring-purple/50",
      )}
    >
      {label}
    </span>
  );
}

function CategoryDetail({
  category,
  override,
  setOverride,
  clearOverride,
}: {
  category: SampleCategory;
  override: Override | undefined;
  setOverride: (partial: Partial<Override>) => void;
  clearOverride: () => void;
}) {
  const currentScore = override?.score ?? category.aiScore;
  const isLikert = category.scaleType === "likert_5";
  const steps: number[] = isLikert ? [1, 2, 3, 4, 5] : [0, 1];

  const onReasonKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.currentTarget.blur();
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3">
      <div>
        <div className="mb-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Sparkles className="size-3.5 text-purple" />
          AI reasoning
        </div>
        <p className="text-base leading-snug text-foreground">
          {category.aiReasoning}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Your score:</span>
        <div className="flex items-center overflow-hidden rounded-md border border-border bg-background">
          {steps.map((n) => {
            const isSelected = n === currentScore;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setOverride({ score: n })}
                className={cn(
                  "cursor-pointer border-r border-border px-2.5 py-1 text-base font-medium tabular-nums transition-colors last:border-r-0",
                  isSelected
                    ? "bg-blue text-primary-foreground"
                    : "text-foreground hover:bg-accent",
                )}
                aria-pressed={isSelected}
              >
                {category.scaleType === "binary"
                  ? n === 1
                    ? "Pass"
                    : "Fail"
                  : n}
              </button>
            );
          })}
        </div>
        <span className="text-sm text-muted-foreground">
          AI:{" "}
          <span className="font-medium text-foreground tabular-nums">
            {category.aiScore}
            {isLikert ? "/5" : category.aiScore === 1 ? " pass" : " fail"}
          </span>
        </span>
        {override && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearOverride}
            className="ml-auto cursor-pointer text-sm"
          >
            <Undo2 className="size-3.5" />
            Reset
          </Button>
        )}
      </div>

      <Textarea
        value={override?.reason ?? ""}
        onChange={(e) => setOverride({ reason: e.target.value })}
        onKeyDown={onReasonKey}
        placeholder="Why are you overriding? (visible to the agent)"
        className="min-h-16 resize-none text-base"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Footer — keyboard shortcut hints

function ShortcutBar() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-grey-lighter/40 px-4 py-2 text-sm text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <ShortcutHint keys={["J"]} label="Next category" />
        <ShortcutHint keys={["K"]} label="Previous category" />
        <ShortcutHint keys={["1", "–", "5"]} label="Score active category" />
        <ShortcutHint
          keys={[<CornerDownLeft key="enter" className="size-3" />]}
          label="Approve & next ticket"
        />
      </div>
      <div>
        Reviewing as <span className="text-foreground">QA lead</span>
      </div>
    </div>
  );
}

function ShortcutHint({
  keys,
  label,
}: {
  keys: React.ReactNode[];
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-center gap-0.5">
        {keys.map((k, i) => (
          <Kbd key={i}>{k}</Kbd>
        ))}
      </span>
      {label}
    </span>
  );
}
