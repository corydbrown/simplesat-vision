"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Sparkles, Star } from "lucide-react";
import {
  sampleTicket,
  type SampleCategory,
  type SampleMessage,
} from "@/lib/mockups/sample-data";
import { cn } from "@/lib/utils";

/* ───────────────────────────────────────────────────────────────────────────
 * Stained-glass encoding
 *
 * Every category gets a hue. Cited messages wear thin colored side-stripes
 * on their outside edge — one per category citation, stacked vertically.
 * Context messages (the customer turns that prompted a cited agent move)
 * carry a softer tint of the same hue. No hover required — the score
 * topology is visible at a glance.
 * ─────────────────────────────────────────────────────────────────────── */

type CatHue = "blue" | "teal" | "purple" | "yellow" | "green";

const CATEGORY_HUE: Record<string, CatHue> = {
  cat_acknowledge: "blue",
  cat_diagnose: "teal",
  cat_options: "purple",
  cat_followthrough: "yellow",
  cat_policy: "green",
};

/** Adjacent customer messages that *prompted* a cited agent move. These carry
 *  a softer-tinted stripe so the convo reads as cause-and-effect, not just
 *  isolated agent moves. Hand-curated for the sample ticket. */
const CONTEXT_CITATIONS: Record<string, string[]> = {
  msg_1: ["cat_acknowledge", "cat_diagnose"],
  msg_4: ["cat_options"],
  msg_6: ["cat_followthrough"],
  msg_8: ["cat_followthrough"],
};

const HUE: Record<
  CatHue,
  {
    swatch: string; // solid hue chip
    stripe: string; // saturated stripe for cited
    stripeSoft: string; // muted stripe for context
    text: string;
    textDark: string;
    bgSoft: string;
    border: string;
    ring: string;
    star: string;
  }
> = {
  blue: {
    swatch: "bg-blue",
    stripe: "bg-blue",
    stripeSoft: "bg-blue-light",
    text: "text-blue-dark",
    textDark: "text-blue-darker",
    bgSoft: "bg-blue-lighter",
    border: "border-blue",
    ring: "ring-blue",
    star: "text-blue-dark",
  },
  teal: {
    swatch: "bg-teal",
    stripe: "bg-teal",
    stripeSoft: "bg-teal-light",
    text: "text-teal-dark",
    textDark: "text-teal-darker",
    bgSoft: "bg-teal-lighter",
    border: "border-teal",
    ring: "ring-teal",
    star: "text-teal-dark",
  },
  purple: {
    swatch: "bg-purple",
    stripe: "bg-purple",
    stripeSoft: "bg-purple-light",
    text: "text-purple-dark",
    textDark: "text-purple-darker",
    bgSoft: "bg-purple-lighter",
    border: "border-purple",
    ring: "ring-purple",
    star: "text-purple-dark",
  },
  yellow: {
    swatch: "bg-yellow",
    stripe: "bg-yellow",
    stripeSoft: "bg-yellow-light",
    text: "text-yellow-dark",
    textDark: "text-yellow-darker",
    bgSoft: "bg-yellow-lighter",
    border: "border-yellow",
    ring: "ring-yellow",
    star: "text-yellow-dark",
  },
  green: {
    swatch: "bg-green",
    stripe: "bg-green",
    stripeSoft: "bg-green-light",
    text: "text-green-dark",
    textDark: "text-green-darker",
    bgSoft: "bg-green-lighter",
    border: "border-green",
    ring: "ring-green",
    star: "text-green-dark",
  },
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

type MessageStripe = { hue: CatHue; kind: "cited" | "context"; catId: string };

function getStripesForMessage(
  msgId: string,
  citedByCategory: Map<string, string[]>,
): MessageStripe[] {
  const cited: MessageStripe[] = [];
  citedByCategory.forEach((msgIds, catId) => {
    if (msgIds.includes(msgId)) {
      const hue = CATEGORY_HUE[catId];
      if (hue) cited.push({ hue, kind: "cited", catId });
    }
  });
  const context = (CONTEXT_CITATIONS[msgId] ?? []).map<MessageStripe>(
    (catId) => ({ hue: CATEGORY_HUE[catId], kind: "context", catId }),
  );
  return [...cited, ...context];
}

export default function StainedGlassMockupPage() {
  const ticket = sampleTicket;
  const { evaluation, messages } = ticket;

  const [hoverCatId, setHoverCatId] = useState<string | null>(null);
  const [coachingOpen, setCoachingOpen] = useState(false);

  const citedByCategory = useMemo(() => {
    const m = new Map<string, string[]>();
    evaluation.categories.forEach((c) =>
      m.set(c.id, c.highlightedMessageIds),
    );
    return m;
  }, [evaluation.categories]);

  const stripesByMessage = useMemo(() => {
    const m = new Map<string, MessageStripe[]>();
    messages.forEach((msg) =>
      m.set(msg.id, getStripesForMessage(msg.id, citedByCategory)),
    );
    return m;
  }, [messages, citedByCategory]);

  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  function scrollToMessage(id: string) {
    messageRefs.current[id]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  const hoverCat = hoverCatId
    ? (evaluation.categories.find((c) => c.id === hoverCatId) ?? null)
    : null;
  const hoverHighlightIds = useMemo(() => {
    if (!hoverCat) return null;
    return new Set(hoverCat.highlightedMessageIds);
  }, [hoverCat]);

  return (
    <div className="relative pr-[360px]">
      <TicketHeader ticket={ticket} />

      <div className="space-y-3">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            stripes={stripesByMessage.get(msg.id) ?? []}
            dimmed={
              hoverHighlightIds !== null && !hoverHighlightIds.has(msg.id)
            }
            highlighted={hoverHighlightIds?.has(msg.id) ?? false}
            highlightHue={hoverCat ? CATEGORY_HUE[hoverCat.id] : null}
            registerRef={(el) => {
              messageRefs.current[msg.id] = el;
            }}
          />
        ))}
      </div>

      <aside className="absolute right-0 top-0 z-20 w-[340px]">
        <div className="sticky top-4">
          <FloatingPanel
            evaluation={evaluation}
            messages={messages}
            stripesByMessage={stripesByMessage}
            hoverCatId={hoverCatId}
            onHover={setHoverCatId}
            onJumpToMessage={scrollToMessage}
            coachingOpen={coachingOpen}
            onToggleCoaching={() => setCoachingOpen((v) => !v)}
          />
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
  stripes,
  dimmed,
  highlighted,
  highlightHue,
  registerRef,
}: {
  message: SampleMessage;
  stripes: MessageStripe[];
  dimmed: boolean;
  highlighted: boolean;
  highlightHue: CatHue | null;
  registerRef: (el: HTMLDivElement | null) => void;
}) {
  const isAgent = message.role === "agent";

  return (
    <div
      ref={registerRef}
      className={cn(
        "flex scroll-mt-24 gap-3 transition-all duration-300 ease-out",
        isAgent ? "flex-row-reverse" : "flex-row",
        dimmed && "opacity-30 blur-[0.5px]",
        highlighted && "scale-[1.005]",
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
        <div className={cn("inline-block", isAgent ? "pr-3" : "pl-3")}>
          <div
            className={cn(
              "relative rounded-2xl border px-4 py-3 text-base text-left transition-all duration-300 ease-out",
              isAgent
                ? "rounded-tr-sm bg-primary/10 border-primary/20 text-foreground"
                : "rounded-tl-sm bg-card border-border text-foreground",
              highlighted &&
                highlightHue &&
                cn(
                  "ring-2 ring-offset-2 ring-offset-background shadow-md",
                  HUE[highlightHue].ring,
                ),
            )}
          >
            {message.body}
          </div>
          {stripes.length > 0 && (
            <StripeStack stripes={stripes} side={isAgent ? "right" : "left"} />
          )}
        </div>
      </div>
    </div>
  );
}

function StripeStack({
  stripes,
  side,
}: {
  stripes: MessageStripe[];
  side: "left" | "right";
}) {
  // Stripes hang on the bubble's outside edge — outside the agent's right edge
  // or outside the customer's left edge — so the bubble itself stays clean.
  return (
    <div
      aria-hidden
      className={cn(
        "absolute inset-y-7 flex w-1.5 flex-col gap-1",
        side === "right" ? "right-0" : "left-0",
      )}
    >
      {stripes.map((s, i) => {
        const styles = HUE[s.hue];
        return (
          <span
            key={`${s.catId}-${i}`}
            className={cn(
              "flex-1 rounded-full transition-opacity duration-300",
              s.kind === "cited" ? styles.stripe : styles.stripeSoft,
              s.kind === "context" && "opacity-70",
            )}
            title={s.catId}
          />
        );
      })}
    </div>
  );
}

function FloatingPanel({
  evaluation,
  messages,
  stripesByMessage,
  hoverCatId,
  onHover,
  onJumpToMessage,
  coachingOpen,
  onToggleCoaching,
}: {
  evaluation: typeof sampleTicket.evaluation;
  messages: SampleMessage[];
  stripesByMessage: Map<string, MessageStripe[]>;
  hoverCatId: string | null;
  onHover: (id: string | null) => void;
  onJumpToMessage: (id: string) => void;
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
      />
      <div className="border-t border-border" />
      <Topology
        messages={messages}
        stripesByMessage={stripesByMessage}
        hoverCatId={hoverCatId}
        onJump={onJumpToMessage}
      />
      <div className="border-t border-border" />
      <div className="p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-sm font-medium text-muted-foreground">
            Categories
          </span>
          <span className="text-sm text-muted-foreground">
            Hover to spotlight
          </span>
        </div>
        <ul className="space-y-1.5">
          {evaluation.categories.map((cat) => (
            <CategoryItem
              key={cat.id}
              category={cat}
              hovered={hoverCatId === cat.id}
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
}: {
  score: number;
  confidence: number;
}) {
  const scoreHue: CatHue =
    score >= 90 ? "green" : score >= 75 ? "teal" : score >= 60 ? "yellow" : "blue";
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
    </div>
  );
}

function ScoreRing({ value, hue }: { value: number; hue: CatHue }) {
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
        className={cn("transition-[stroke-dashoffset] duration-700 ease-out", {
          "stroke-blue": hue === "blue",
          "stroke-teal": hue === "teal",
          "stroke-purple": hue === "purple",
          "stroke-yellow": hue === "yellow",
          "stroke-green": hue === "green",
        })}
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

function Topology({
  messages,
  stripesByMessage,
  hoverCatId,
  onJump,
}: {
  messages: SampleMessage[];
  stripesByMessage: Map<string, MessageStripe[]>;
  hoverCatId: string | null;
  onJump: (id: string) => void;
}) {
  return (
    <div className="px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Topology
        </span>
        <span className="text-sm text-muted-foreground">
          {messages.length} messages · click to jump
        </span>
      </div>
      <div className="flex items-stretch gap-0.5">
        {messages.map((msg) => {
          const stripes = stripesByMessage.get(msg.id) ?? [];
          const cited = stripes.filter((s) => s.kind === "cited");
          const context = stripes.filter((s) => s.kind === "context");
          const isAgent = msg.role === "agent";
          const matchesHover = hoverCatId
            ? stripes.some((s) => s.catId === hoverCatId && s.kind === "cited")
            : false;
          const dimmed = hoverCatId !== null && !matchesHover;
          return (
            <button
              key={msg.id}
              type="button"
              onClick={() => onJump(msg.id)}
              className={cn(
                "group relative flex h-14 min-w-0 flex-1 cursor-pointer flex-col gap-0.5 rounded-md p-1 transition-all",
                dimmed ? "opacity-30" : "hover:bg-accent/50",
              )}
              aria-label={`Jump to ${msg.authorName}`}
            >
              <span
                className={cn(
                  "h-1 w-full rounded-full",
                  isAgent ? "bg-primary/60" : "bg-muted-foreground/30",
                )}
                aria-hidden
              />
              <div className="flex flex-1 flex-col-reverse gap-0.5">
                {[...cited, ...context].map((s, i) => {
                  const styles = HUE[s.hue];
                  return (
                    <span
                      key={`${s.catId}-${i}`}
                      className={cn(
                        "flex-1 rounded-sm",
                        s.kind === "cited"
                          ? styles.stripe
                          : cn(styles.stripeSoft, "opacity-70"),
                      )}
                    />
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CategoryItem({
  category,
  hovered,
  onHover,
}: {
  category: SampleCategory;
  hovered: boolean;
  onHover: (id: string | null) => void;
}) {
  const hue = CATEGORY_HUE[category.id];
  const styles = HUE[hue];
  const citedCount = category.highlightedMessageIds.length;
  return (
    <li>
      <button
        type="button"
        onMouseEnter={() => onHover(category.id)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(category.id)}
        onBlur={() => onHover(null)}
        className={cn(
          "group relative w-full cursor-pointer overflow-hidden rounded-lg border px-3 py-2.5 text-left transition-all duration-200",
          hovered
            ? cn(styles.bgSoft, styles.border, "shadow-sm")
            : "border-transparent bg-transparent hover:bg-accent/50",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-2 left-0 w-1 rounded-r-full transition-opacity duration-200",
            styles.stripe,
            hovered ? "opacity-100" : "opacity-70",
          )}
        />
        <div className="flex items-center justify-between gap-2 pl-2">
          <span
            className={cn(
              "truncate text-base font-medium",
              hovered ? styles.textDark : "text-foreground",
            )}
          >
            {category.name}
          </span>
          <ScoreBadge category={category} hue={hue} />
        </div>
        <div className="mt-1 flex items-center gap-2 pl-2 text-sm text-muted-foreground">
          <span>{category.weightPercent}%</span>
          {category.isAutofail && (
            <>
              <span aria-hidden>·</span>
              <span className="font-medium text-red-darker">Autofail</span>
            </>
          )}
          <span aria-hidden>·</span>
          <span className="flex items-center gap-1">
            <span className="flex items-center gap-0.5">
              {Array.from({ length: citedCount }).map((_, i) => (
                <span
                  key={i}
                  className={cn("size-1.5 rounded-full", styles.stripe)}
                />
              ))}
            </span>
            <span>
              {citedCount} cited
            </span>
          </span>
        </div>
      </button>
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
              ? cn(styles.star, "fill-current")
              : "text-border",
          )}
        />
      ))}
    </span>
  );
}
