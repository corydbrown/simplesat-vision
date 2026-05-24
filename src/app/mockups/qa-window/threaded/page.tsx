"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Sparkles, Star } from "lucide-react";
import {
  sampleTicket,
  type SampleCategory,
  type SampleMessage,
} from "@/lib/mockups/sample-data";
import { cn } from "@/lib/utils";

type CatHue = "purple" | "blue" | "teal" | "green" | "yellow";

const CAT_HUE: Record<string, CatHue> = {
  cat_acknowledge: "purple",
  cat_diagnose: "blue",
  cat_options: "teal",
  cat_followthrough: "green",
  cat_policy: "yellow",
};

const HUE_STROKE: Record<CatHue, string> = {
  purple: "var(--purple)",
  blue: "var(--blue)",
  teal: "var(--teal-dark)",
  green: "var(--green)",
  yellow: "var(--yellow-dark)",
};

const HUE_CLASSES: Record<
  CatHue,
  {
    bgSoft: string;
    bg: string;
    text: string;
    textDark: string;
    border: string;
    ring: string;
    dot: string;
  }
> = {
  purple: {
    bgSoft: "bg-purple-lighter",
    bg: "bg-purple",
    text: "text-purple-dark",
    textDark: "text-purple-darker",
    border: "border-purple",
    ring: "ring-purple",
    dot: "bg-purple",
  },
  blue: {
    bgSoft: "bg-blue-lighter",
    bg: "bg-blue",
    text: "text-blue-dark",
    textDark: "text-blue-darker",
    border: "border-blue",
    ring: "ring-blue",
    dot: "bg-blue",
  },
  teal: {
    bgSoft: "bg-teal-lighter",
    bg: "bg-teal",
    text: "text-teal-dark",
    textDark: "text-teal-darker",
    border: "border-teal",
    ring: "ring-teal",
    dot: "bg-teal",
  },
  green: {
    bgSoft: "bg-green-lighter",
    bg: "bg-green",
    text: "text-green-dark",
    textDark: "text-green-darker",
    border: "border-green",
    ring: "ring-green",
    dot: "bg-green",
  },
  yellow: {
    bgSoft: "bg-yellow-lighter",
    bg: "bg-yellow",
    text: "text-yellow-dark",
    textDark: "text-yellow-darker",
    border: "border-yellow",
    ring: "ring-yellow",
    dot: "bg-yellow",
  },
};

type Thread = {
  id: string;
  catId: string;
  msgId: string;
  hue: CatHue;
  d: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ThreadedMockupPage() {
  const ticket = sampleTicket;
  const { evaluation, messages } = ticket;

  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoverCatId, setHoverCatId] = useState<string | null>(null);
  const [hoverMsgId, setHoverMsgId] = useState<string | null>(null);
  const [coachingOpen, setCoachingOpen] = useState(false);

  const focusCatId = activeId ?? hoverCatId;
  const focusCategory = focusCatId
    ? (evaluation.categories.find((c) => c.id === focusCatId) ?? null)
    : null;

  const focusedMessageIds = useMemo(() => {
    if (!focusCategory) return null;
    return new Set(focusCategory.highlightedMessageIds);
  }, [focusCategory]);

  // Map of msg id → category ids that cite it (for the "this msg is doing work
  // for these N categories" affordance when you hover a bubble).
  const citationsByMsg = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const cat of evaluation.categories) {
      for (const msgId of cat.highlightedMessageIds) {
        const arr = map.get(msgId) ?? [];
        arr.push(cat.id);
        map.set(msgId, arr);
      }
    }
    return map;
  }, [evaluation.categories]);

  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const bubbleRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [threads, setThreads] = useState<Thread[]>([]);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  const recompute = useCallback(() => {
    const newThreads: Thread[] = [];
    const w = window.innerWidth;
    const h = window.innerHeight;
    setViewport({ w, h });

    for (const [msgId, catIds] of citationsByMsg) {
      const bubbleEl = bubbleRefs.current[msgId];
      if (!bubbleEl) continue;
      const mRect = bubbleEl.getBoundingClientRect();

      catIds.forEach((catId, idx) => {
        const catEl = categoryRefs.current[catId];
        if (!catEl) return;
        const cRect = catEl.getBoundingClientRect();
        const hue = CAT_HUE[catId];
        if (!hue) return;

        // Distribute startY across the bubble's vertical edge when one bubble
        // feeds multiple categories — so the threads don't stack on top of
        // each other.
        const n = catIds.length;
        const fraction =
          n === 1 ? 0.5 : 0.28 + (0.44 * idx) / (n - 1);
        const startX = mRect.right + 2;
        const startY = mRect.top + mRect.height * fraction;
        const endX = cRect.left - 2;
        const endY = cRect.top + cRect.height / 2;

        const dx = endX - startX;
        // Asymmetric control points → S-curve that leaves the bubble
        // horizontally and meets the card horizontally.
        const c1x = startX + Math.max(60, dx * 0.55);
        const c2x = endX - Math.max(60, dx * 0.45);
        // Tiny deterministic vertical wiggle on the control points so the
        // lines feel hand-strung, not robotic.
        const wiggle = ((hashCode(msgId + catId) % 100) / 100 - 0.5) * 18;
        const c1y = startY + wiggle;
        const c2y = endY - wiggle;

        const d = `M ${startX.toFixed(1)},${startY.toFixed(1)} C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${endX.toFixed(1)},${endY.toFixed(1)}`;

        newThreads.push({
          id: `${catId}-${msgId}`,
          catId,
          msgId,
          hue,
          d,
          startX,
          startY,
          endX,
          endY,
        });
      });
    }
    setThreads(newThreads);
  }, [citationsByMsg]);

  // rAF-throttled scroll/resize handler.
  const rafRef = useRef<number | null>(null);
  const scheduleRecompute = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      recompute();
    });
  }, [recompute]);

  useLayoutEffect(() => {
    // Measure-then-setState is the whole point here — we need viewport+thread
    // geometry available on the first paint after layout settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recompute();
  }, [recompute]);

  useEffect(() => {
    const ro = new ResizeObserver(() => scheduleRecompute());
    for (const el of Object.values(bubbleRefs.current)) {
      if (el) ro.observe(el);
    }
    for (const el of Object.values(categoryRefs.current)) {
      if (el) ro.observe(el);
    }
    ro.observe(document.documentElement);

    window.addEventListener("scroll", scheduleRecompute, true);
    window.addEventListener("resize", scheduleRecompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", scheduleRecompute, true);
      window.removeEventListener("resize", scheduleRecompute);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [scheduleRecompute]);

  // When a category becomes active, scroll its first cited message into view.
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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (!activeId) return;
    const target = e.target as Element;
    if (target.closest("[data-cat-card]")) return;
    setActiveId(null);
  };

  const cited = (msgId: string) =>
    citationsByMsg.has(msgId) && (citationsByMsg.get(msgId)?.length ?? 0) > 0;

  return (
    <div className="relative" onClick={handleBackdropClick}>
      <div className="pr-[360px]">
        <TicketHeader ticket={ticket} />
        <div className="space-y-4">
          {messages.map((msg) => {
            const isCited = cited(msg.id);
            const isFocusedByCat =
              focusedMessageIds?.has(msg.id) ?? false;
            const isDimmedByCat =
              focusedMessageIds !== null && !isFocusedByCat;
            const isHovered = hoverMsgId === msg.id;
            // Color hint pulled from the FIRST citing category — used as a
            // subtle background tint on the bubble when it's lit up by the
            // focused category.
            const tintHue: CatHue | null = isFocusedByCat
              ? CAT_HUE[focusCategory?.id ?? ""] ?? null
              : null;

            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                isCited={isCited}
                isFocusedByCat={isFocusedByCat}
                isDimmed={isDimmedByCat}
                isHovered={isHovered}
                tintHue={tintHue}
                citationHues={(citationsByMsg.get(msg.id) ?? [])
                  .map((id) => CAT_HUE[id])
                  .filter(Boolean) as CatHue[]}
                onMouseEnter={() =>
                  isCited ? setHoverMsgId(msg.id) : undefined
                }
                onMouseLeave={() => setHoverMsgId(null)}
                registerRef={(el) => {
                  messageRefs.current[msg.id] = el;
                }}
                registerBubbleRef={(el) => {
                  bubbleRefs.current[msg.id] = el;
                }}
              />
            );
          })}
        </div>
      </div>

      <aside className="absolute right-0 top-0 w-[340px]">
        <div className="sticky top-4 space-y-3">
          <ScoreHeader
            score={evaluation.overallScore}
            confidence={evaluation.aiConfidence}
          />
          <ul className="space-y-2">
            {evaluation.categories.map((cat) => (
              <CategoryCard
                key={cat.id}
                category={cat}
                active={activeId === cat.id}
                dimmed={activeId !== null && activeId !== cat.id}
                hovered={hoverCatId === cat.id}
                onSelect={() =>
                  setActiveId((curr) => (curr === cat.id ? null : cat.id))
                }
                onMouseEnter={() => setHoverCatId(cat.id)}
                onMouseLeave={() => setHoverCatId(null)}
                registerRef={(el) => {
                  categoryRefs.current[cat.id] = el;
                }}
              />
            ))}
          </ul>
          <CoachingPanel
            coaching={evaluation.coaching}
            open={coachingOpen}
            onToggle={() => setCoachingOpen((v) => !v)}
          />
        </div>
      </aside>

      <ThreadOverlay
        threads={threads}
        viewport={viewport}
        focusCatId={focusCatId}
        hoverMsgId={hoverMsgId}
        activeId={activeId}
      />
    </div>
  );
}

function ThreadOverlay({
  threads,
  viewport,
  focusCatId,
  hoverMsgId,
  activeId,
}: {
  threads: Thread[];
  viewport: { w: number; h: number };
  focusCatId: string | null;
  hoverMsgId: string | null;
  activeId: string | null;
}) {
  const anyFocus = focusCatId !== null || hoverMsgId !== null;

  return (
    <svg
      aria-hidden
      className="pointer-events-none fixed inset-0 z-30"
      width={viewport.w}
      height={viewport.h}
      viewBox={`0 0 ${viewport.w} ${viewport.h}`}
      style={{ overflow: "visible" }}
    >
      {threads.map((t) => {
        const stroke = HUE_STROKE[t.hue];
        const isCatLit = focusCatId === t.catId;
        const isMsgLit = hoverMsgId === t.msgId;
        const isLit = isCatLit || isMsgLit;
        const opacity = anyFocus ? (isLit ? 1 : 0.08) : 0.28;
        const width = isLit ? 2.25 : 1.4;
        const dotR = isLit ? 5 : 3.5;
        const isStuck = activeId === t.catId;
        return (
          <g
            key={t.id}
            style={{
              opacity,
              transition:
                "opacity 280ms ease-out, stroke-width 280ms ease-out",
            }}
          >
            <path
              d={t.d}
              fill="none"
              stroke={stroke}
              strokeWidth={width}
              strokeLinecap="round"
              style={{
                transition:
                  "stroke-width 280ms ease-out, filter 280ms ease-out",
                filter: isLit
                  ? `drop-shadow(0 0 6px ${stroke})`
                  : "none",
              }}
            />
            <circle
              cx={t.startX}
              cy={t.startY}
              r={dotR}
              fill={stroke}
              style={{
                transition: "r 280ms ease-out",
              }}
            />
            <circle
              cx={t.endX}
              cy={t.endY}
              r={dotR}
              fill={stroke}
              style={{
                transition: "r 280ms ease-out",
              }}
            />
            {isStuck && (
              <circle
                cx={t.endX}
                cy={t.endY}
                r={dotR + 4}
                fill="none"
                stroke={stroke}
                strokeWidth={1.5}
                opacity={0.5}
                style={{
                  animation: "qa-thread-pulse 1.6s ease-in-out infinite",
                }}
              />
            )}
          </g>
        );
      })}
      <style>{`
        @keyframes qa-thread-pulse {
          0%, 100% { transform-origin: ${0} ${0}; opacity: 0.5; }
          50% { opacity: 0.05; }
        }
      `}</style>
    </svg>
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
  isCited,
  isFocusedByCat,
  isDimmed,
  isHovered,
  tintHue,
  citationHues,
  onMouseEnter,
  onMouseLeave,
  registerRef,
  registerBubbleRef,
}: {
  message: SampleMessage;
  isCited: boolean;
  isFocusedByCat: boolean;
  isDimmed: boolean;
  isHovered: boolean;
  tintHue: CatHue | null;
  citationHues: CatHue[];
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  registerRef: (el: HTMLDivElement | null) => void;
  registerBubbleRef: (el: HTMLDivElement | null) => void;
}) {
  const isAgent = message.role === "agent";
  const tint = tintHue ? HUE_CLASSES[tintHue] : null;

  return (
    <div
      ref={registerRef}
      className={cn(
        "flex scroll-mt-24 gap-3 transition-all duration-500 ease-out",
        isAgent ? "flex-row-reverse" : "flex-row",
        isDimmed && "opacity-40",
        (isFocusedByCat || isHovered) && "scale-[1.01]",
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
          {isCited && (
            <span className="flex items-center gap-0.5">
              {citationHues.map((h, i) => (
                <span
                  key={i}
                  aria-hidden
                  className={cn(
                    "inline-block size-1.5 rounded-full",
                    HUE_CLASSES[h].dot,
                  )}
                />
              ))}
            </span>
          )}
        </div>
        <div
          ref={registerBubbleRef}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className={cn(
            "relative inline-block rounded-2xl border px-4 py-3 text-base text-left transition-all duration-500 ease-out",
            isAgent
              ? "rounded-tr-sm bg-primary/10 border-primary/20 text-foreground"
              : "rounded-tl-sm bg-card border-border text-foreground",
            isCited && "cursor-pointer",
            isFocusedByCat && tint && cn("shadow-md", tint.bgSoft),
            isHovered && !isFocusedByCat && "shadow-md",
          )}
        >
          {message.body}
        </div>
      </div>
    </div>
  );
}

function ScoreHeader({
  score,
  confidence,
}: {
  score: number;
  confidence: number;
}) {
  const hue: CatHue =
    score >= 90
      ? "green"
      : score >= 75
        ? "teal"
        : score >= 60
          ? "yellow"
          : "purple";
  return (
    <div className="rounded-xl border border-border bg-card/95 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <ScoreRing value={score} hue={hue} />
        <div className="min-w-0 flex-1">
          <div className="text-sm text-muted-foreground">QA evaluation</div>
          <div className="text-base font-medium text-foreground">
            AI scored · {confidence}% confidence
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreRing({ value, hue }: { value: number; hue: CatHue }) {
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (value / 100) * circumference;
  const strokeClass = {
    purple: "stroke-purple",
    blue: "stroke-blue",
    teal: "stroke-teal",
    green: "stroke-green",
    yellow: "stroke-yellow",
  }[hue];
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
          strokeClass,
        )}
      />
      <text
        x="24"
        y="24"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground"
        style={{ fontSize: "14px", fontWeight: 600 }}
      >
        {value}
      </text>
    </svg>
  );
}

function CategoryCard({
  category,
  active,
  dimmed,
  hovered,
  onSelect,
  onMouseEnter,
  onMouseLeave,
  registerRef,
}: {
  category: SampleCategory;
  active: boolean;
  dimmed: boolean;
  hovered: boolean;
  onSelect: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  registerRef: (el: HTMLDivElement | null) => void;
}) {
  const hue = CAT_HUE[category.id];
  const styles = HUE_CLASSES[hue];
  return (
    <li>
      <div
        ref={registerRef}
        data-cat-card
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            "group relative w-full cursor-pointer overflow-hidden rounded-lg border bg-card px-3 py-2.5 text-left shadow-sm transition-all duration-200",
            active
              ? cn(styles.bgSoft, styles.border, "shadow-md")
              : hovered
                ? cn("border-border", styles.bgSoft)
                : "border-border hover:bg-accent/30",
            dimmed && "opacity-50",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "absolute inset-y-2 left-0 w-1 rounded-r-full transition-all duration-200",
              styles.bg,
              active || hovered
                ? "opacity-100"
                : "opacity-60 group-hover:opacity-90",
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
              {category.highlightedMessageIds.length} thread
              {category.highlightedMessageIds.length === 1 ? "" : "s"}
            </span>
          </div>
          {active && (
            <p className="mt-2 pl-2 text-base text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-200">
              {category.aiReasoning}
            </p>
          )}
        </button>
      </div>
    </li>
  );
}

function ScoreBadge({
  category,
  hue,
}: {
  category: SampleCategory;
  hue: CatHue;
}) {
  const styles = HUE_CLASSES[hue];
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

function CoachingPanel({
  coaching,
  open,
  onToggle,
}: {
  coaching: typeof sampleTicket.evaluation.coaching;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/95 shadow-sm backdrop-blur-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center justify-between px-4 py-2.5 text-base font-medium text-foreground transition-colors hover:bg-accent/50"
      >
        <span className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          Coaching
        </span>
        <span className="text-sm text-muted-foreground">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open && (
        <div className="space-y-3 px-4 pb-4 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
          <div>
            <div className="mb-1 text-sm font-medium text-green-darker">
              Strengths
            </div>
            <ul className="space-y-1 text-base text-muted-foreground">
              {coaching.strengthPoints.map((p) => (
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
              {coaching.growthPoints.map((p) => (
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
  );
}

function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
