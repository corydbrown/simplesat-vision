"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  CornerDownLeft,
  MessageSquarePlus,
  Sparkles,
  Star,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
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

type Citation = {
  /** messageId::categoryId — also serves as the React key. */
  key: string;
  messageId: string;
  categoryId: string;
  /** Per-citation score override (defaults to the category's effectiveScore). */
  score: number;
  aiSuggested: boolean;
};

type Comment = {
  id: string;
  targetId: string; // messageId or activityId
  authorName: string;
  authorInitials: string;
  body: string;
  createdAt: string; // pre-formatted relative
};

type Activity = {
  id: string;
  /** After which message id this activity should render (when toggle is ON). */
  afterMessageId: string;
  text: string;
  createdAt: string;
};

function buildInitialCitations(categories: SampleCategory[]): Citation[] {
  const out: Citation[] = [];
  for (const cat of categories) {
    for (const msgId of cat.highlightedMessageIds) {
      out.push({
        key: `${msgId}::${cat.id}`,
        messageId: msgId,
        categoryId: cat.id,
        score: cat.effectiveScore,
        aiSuggested: true,
      });
    }
  }
  return out;
}

const initialComments: Comment[] = [
  {
    id: "cmt_1",
    targetId: "msg_3",
    authorName: "Jamie Liu",
    authorInitials: "JL",
    body: "Nice diagnosis — but lead with the empathy next time. Priya was anxious about Saturday before she needed an explanation.",
    createdAt: "2 days ago",
  },
  {
    id: "cmt_2",
    targetId: "msg_5",
    authorName: "Jamie Liu",
    authorInitials: "JL",
    body: "Textbook two-option close. Reuse this pattern when shipping issues come with a deadline.",
    createdAt: "2 days ago",
  },
  {
    id: "cmt_3",
    targetId: "msg_7",
    authorName: "Devon Park",
    authorInitials: "DP",
    body: "Discount call was within SOP — good instinct. Wall-clock ETA would have made this a 5.",
    createdAt: "1 day ago",
  },
];

const activities: Activity[] = [
  {
    id: "act_1",
    afterMessageId: "msg_1",
    text: "Marisol assigned this ticket to herself",
    createdAt: "14:03",
  },
  {
    id: "act_2",
    afterMessageId: "msg_1",
    text: "Priority set to High",
    createdAt: "14:03",
  },
  {
    id: "act_3",
    afterMessageId: "msg_2",
    text: "SLA timer started — 4h to first response",
    createdAt: "14:05",
  },
  {
    id: "act_4",
    afterMessageId: "msg_6",
    text: "Tags added: shipping-issue, reship, event-deadline",
    createdAt: "14:24",
  },
  {
    id: "act_5",
    afterMessageId: "msg_8",
    text: "Marisol marked this ticket as Solved",
    createdAt: "14:36",
  },
];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function PopoverMockupPage() {
  const ticket = sampleTicket;
  const { evaluation, messages } = ticket;

  const [citations, setCitations] = useState<Citation[]>(() =>
    buildInitialCitations(evaluation.categories),
  );
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [draftingCommentFor, setDraftingCommentFor] = useState<string | null>(
    null,
  );
  const [showActivity, setShowActivity] = useState(false);
  const [pulseCategoryId, setPulseCategoryId] = useState<string | null>(null);
  const [coachingOpen, setCoachingOpen] = useState(false);

  const citationsByMessage = useMemo(() => {
    const m = new Map<string, Citation[]>();
    for (const c of citations) {
      const arr = m.get(c.messageId) ?? [];
      arr.push(c);
      m.set(c.messageId, arr);
    }
    return m;
  }, [citations]);

  const citationsByCategory = useMemo(() => {
    const m = new Map<string, Citation[]>();
    for (const c of citations) {
      const arr = m.get(c.categoryId) ?? [];
      arr.push(c);
      m.set(c.categoryId, arr);
    }
    return m;
  }, [citations]);

  const commentsByTarget = useMemo(() => {
    const m = new Map<string, Comment[]>();
    for (const c of comments) {
      const arr = m.get(c.targetId) ?? [];
      arr.push(c);
      m.set(c.targetId, arr);
    }
    return m;
  }, [comments]);

  const activitiesByMessage = useMemo(() => {
    const m = new Map<string, Activity[]>();
    for (const a of activities) {
      const arr = m.get(a.afterMessageId) ?? [];
      arr.push(a);
      m.set(a.afterMessageId, arr);
    }
    return m;
  }, []);

  const highlightedMessageIds = useMemo(() => {
    if (!activeCategoryId) return null;
    return new Set(
      (citationsByCategory.get(activeCategoryId) ?? []).map((c) => c.messageId),
    );
  }, [citationsByCategory, activeCategoryId]);

  function pulse(catId: string) {
    setPulseCategoryId(catId);
    window.setTimeout(() => {
      setPulseCategoryId((curr) => (curr === catId ? null : curr));
    }, 700);
  }

  function addCitation(messageId: string, categoryId: string) {
    setCitations((prev) => {
      if (
        prev.some((c) => c.messageId === messageId && c.categoryId === categoryId)
      ) {
        return prev;
      }
      const cat = evaluation.categories.find((c) => c.id === categoryId);
      return [
        ...prev,
        {
          key: `${messageId}::${categoryId}`,
          messageId,
          categoryId,
          score: cat?.effectiveScore ?? 3,
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

  function changeCitationScore(
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
    pulse(categoryId);
  }

  function addComment(targetId: string, body: string) {
    if (!body.trim()) return;
    setComments((prev) => [
      ...prev,
      {
        id: `cmt_${Date.now()}`,
        targetId,
        authorName: "You",
        authorInitials: "YO",
        body: body.trim(),
        createdAt: "just now",
      },
    ]);
    setDraftingCommentFor(null);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      {/* Left column — conversation */}
      <div>
        <TicketHeader ticket={ticket} />

        <div className="mb-4 flex items-center justify-between rounded-lg border border-border bg-card/40 px-3 py-2">
          <div className="text-sm text-muted-foreground">
            Hover any message to coach it — click 💬 to comment or 🎯 to attach
            a category.
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <Switch
              checked={showActivity}
              onCheckedChange={setShowActivity}
              size="sm"
            />
            Show activity
          </label>
        </div>

        <div className="space-y-3">
          {messages.map((msg) => (
            <div key={msg.id}>
              <MessageRow
                message={msg}
                citations={citationsByMessage.get(msg.id) ?? []}
                comments={commentsByTarget.get(msg.id) ?? []}
                categories={evaluation.categories}
                isDimmed={
                  activeCategoryId !== null &&
                  !(highlightedMessageIds?.has(msg.id) ?? false)
                }
                isHighlighted={highlightedMessageIds?.has(msg.id) ?? false}
                drafting={draftingCommentFor === msg.id}
                onOpenDraft={() => setDraftingCommentFor(msg.id)}
                onCloseDraft={() => setDraftingCommentFor(null)}
                onAddComment={(body) => addComment(msg.id, body)}
                onAddCitation={(catId) => addCitation(msg.id, catId)}
                onRemoveCitation={(catId) => removeCitation(msg.id, catId)}
                onChangeCitationScore={(catId, score) =>
                  changeCitationScore(msg.id, catId, score)
                }
              />
              {showActivity &&
                (activitiesByMessage.get(msg.id) ?? []).map((act) => (
                  <ActivityRow
                    key={act.id}
                    activity={act}
                    comments={commentsByTarget.get(act.id) ?? []}
                    isDimmed={activeCategoryId !== null}
                    drafting={draftingCommentFor === act.id}
                    onOpenDraft={() => setDraftingCommentFor(act.id)}
                    onCloseDraft={() => setDraftingCommentFor(null)}
                    onAddComment={(body) => addComment(act.id, body)}
                  />
                ))}
            </div>
          ))}
        </div>
      </div>

      {/* Right column — QA panel */}
      <aside className="lg:relative">
        <div className="lg:sticky lg:top-4 space-y-3">
          <PanelHeader
            score={evaluation.overallScore}
            confidence={evaluation.aiConfidence}
          />
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <span className="text-sm font-medium text-muted-foreground">
                Categories
              </span>
              {activeCategoryId && (
                <button
                  type="button"
                  onClick={() => setActiveCategoryId(null)}
                  className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
            <ul className="space-y-1.5 px-3 pb-3">
              {evaluation.categories.map((cat) => (
                <CategoryCard
                  key={cat.id}
                  category={cat}
                  citationCount={citationsByCategory.get(cat.id)?.length ?? 0}
                  active={activeCategoryId === cat.id}
                  dimmed={
                    activeCategoryId !== null && activeCategoryId !== cat.id
                  }
                  isPulsing={pulseCategoryId === cat.id}
                  onSelect={() =>
                    setActiveCategoryId((curr) =>
                      curr === cat.id ? null : cat.id,
                    )
                  }
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
        </div>
      </aside>
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

function MessageRow({
  message,
  citations,
  comments,
  categories,
  isDimmed,
  isHighlighted,
  drafting,
  onOpenDraft,
  onCloseDraft,
  onAddComment,
  onAddCitation,
  onRemoveCitation,
  onChangeCitationScore,
}: {
  message: SampleMessage;
  citations: Citation[];
  comments: Comment[];
  categories: SampleCategory[];
  isDimmed: boolean;
  isHighlighted: boolean;
  drafting: boolean;
  onOpenDraft: () => void;
  onCloseDraft: () => void;
  onAddComment: (body: string) => void;
  onAddCitation: (categoryId: string) => void;
  onRemoveCitation: (categoryId: string) => void;
  onChangeCitationScore: (categoryId: string, score: number) => void;
}) {
  const isAgent = message.role === "agent";
  const [hovered, setHovered] = useState(false);
  const [categorizeOpen, setCategorizeOpen] = useState(false);

  // The toolbar should remain visible while popovers are open even if the
  // cursor wanders briefly. Combine into a single "active" flag.
  const toolbarVisible = hovered || categorizeOpen || drafting;

  return (
    <div
      className={cn(
        "flex gap-3 transition-opacity duration-300",
        isAgent ? "flex-row-reverse" : "flex-row",
        isDimmed && "opacity-30",
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
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {/* Hover toolbar — positioned just above the bubble */}
          <HoverToolbar
            visible={toolbarVisible}
            isAgent={isAgent}
            categories={categories}
            citationCategoryIds={new Set(citations.map((c) => c.categoryId))}
            categorizeOpen={categorizeOpen}
            onCategorizeOpenChange={setCategorizeOpen}
            onComment={onOpenDraft}
            onAddCitation={(catId) => {
              onAddCitation(catId);
              setCategorizeOpen(false);
            }}
          />

          {/* Bubble */}
          <div
            className={cn(
              "rounded-2xl border px-4 py-3 text-base text-left transition-all duration-150 ease-out cursor-pointer",
              isAgent
                ? "rounded-tr-sm border-primary/20 bg-primary/10 text-foreground"
                : "rounded-tl-sm border-border bg-card text-foreground",
              toolbarVisible && "-translate-y-0.5 shadow-md",
              isHighlighted && "ring-2 ring-offset-2 ring-offset-background",
              isHighlighted &&
                citations[0] &&
                HUE[CATEGORY_HUE[citations[0].categoryId]].ring,
            )}
            onClick={onOpenDraft}
          >
            {message.body}
          </div>
        </div>

        {/* Citation tabs underneath the bubble */}
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
                category={
                  categories.find((cat) => cat.id === c.categoryId) ?? null
                }
                onRemove={() => onRemoveCitation(c.categoryId)}
                onChangeScore={(score) =>
                  onChangeCitationScore(c.categoryId, score)
                }
              />
            ))}
          </div>
        )}

        {/* Comments thread */}
        {(comments.length > 0 || drafting) && (
          <div
            className={cn(
              "flex flex-col gap-1.5 pt-2",
              isAgent ? "items-end" : "items-start",
            )}
          >
            {comments.map((cmt) => (
              <CommentCard key={cmt.id} comment={cmt} align={isAgent ? "right" : "left"} />
            ))}
            {drafting && (
              <CommentDraft
                onSubmit={onAddComment}
                onCancel={onCloseDraft}
                align={isAgent ? "right" : "left"}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function HoverToolbar({
  visible,
  isAgent,
  categories,
  citationCategoryIds,
  categorizeOpen,
  onCategorizeOpenChange,
  onComment,
  onAddCitation,
}: {
  visible: boolean;
  isAgent: boolean;
  categories: SampleCategory[];
  citationCategoryIds: Set<string>;
  categorizeOpen: boolean;
  onCategorizeOpenChange: (open: boolean) => void;
  onComment: () => void;
  onAddCitation: (categoryId: string) => void;
}) {
  return (
    <div
      className={cn(
        "absolute -top-9 z-20 flex items-center gap-0.5 rounded-lg border border-border bg-popover p-0.5 shadow-md transition-all duration-150",
        isAgent ? "right-2" : "left-2",
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-1 pointer-events-none",
      )}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <ToolbarButton onClick={onComment} label="Comment">
        <MessageSquarePlus className="size-4" />
      </ToolbarButton>
      <Popover open={categorizeOpen} onOpenChange={onCategorizeOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Attach category"
            className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Tags className="size-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align={isAgent ? "end" : "start"} className="w-64 p-1.5">
          <div className="px-2 pb-1.5 pt-1 text-sm font-medium text-muted-foreground">
            Attach a category
          </div>
          <ul className="flex flex-col gap-0.5">
            {categories.map((cat) => {
              const hue = HUE[CATEGORY_HUE[cat.id]];
              const already = citationCategoryIds.has(cat.id);
              return (
                <li key={cat.id}>
                  <button
                    type="button"
                    disabled={already}
                    onClick={() => onAddCitation(cat.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-base transition-colors",
                      already
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-pointer hover:bg-accent",
                    )}
                  >
                    <span className={cn("size-2 rounded-full", hue.bg)} />
                    <span className="flex-1 text-foreground">{cat.name}</span>
                    {already && (
                      <span className="text-sm text-muted-foreground">
                        cited
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ToolbarButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}

function CitationTab({
  citation,
  category,
  onRemove,
  onChangeScore,
}: {
  citation: Citation;
  category: SampleCategory | null;
  onRemove: () => void;
  onChangeScore: (score: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const hue = HUE[CATEGORY_HUE[citation.categoryId]];
  if (!category) return null;
  const isBinary = category.scaleType === "binary";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-sm font-medium shadow-sm transition-all hover:-translate-y-px hover:shadow-md",
            hue.bgSoft,
            hue.borderSoft,
            hue.textDark,
          )}
        >
          <span className={cn("size-1.5 rounded-full", hue.bg)} aria-hidden />
          <span>{category.name}</span>
          {citation.aiSuggested && (
            <Sparkles className="size-3 opacity-80" aria-label="AI suggested" />
          )}
          <span className={cn("ml-0.5 text-sm", hue.text)}>
            {isBinary
              ? citation.score === 1
                ? "Pass"
                : "Fail"
              : `${citation.score}/5`}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2" align="start">
        <div className="px-1 pb-2 text-sm font-medium text-muted-foreground">
          {category.name}
        </div>
        {isBinary ? (
          <div className="flex gap-1.5 px-1 pb-1.5">
            {[
              { val: 1, label: "Pass" },
              { val: 0, label: "Fail" },
            ].map(({ val, label }) => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  onChangeScore(val);
                  setOpen(false);
                }}
                className={cn(
                  "flex-1 cursor-pointer rounded-md border px-2 py-1 text-sm transition-colors",
                  citation.score === val
                    ? cn(hue.bgSoft, hue.borderSoft, hue.textDark)
                    : "border-border bg-transparent text-foreground hover:bg-accent",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1 px-1 pb-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  onChangeScore(n);
                  setOpen(false);
                }}
                aria-label={`Score ${n}`}
                className="cursor-pointer rounded-md p-1 transition-colors hover:bg-accent"
              >
                <Star
                  className={cn(
                    "size-4 transition-colors",
                    n <= citation.score
                      ? cn(hue.text, "fill-current")
                      : "text-border",
                  )}
                />
              </button>
            ))}
          </div>
        )}
        <div className="border-t border-border pt-1.5">
          <button
            type="button"
            onClick={() => {
              onRemove();
              setOpen(false);
            }}
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-red-darker transition-colors hover:bg-red-lighter"
          >
            <Trash2 className="size-3.5" />
            <span>Remove citation</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CommentCard({
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
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary",
        )}
        aria-hidden
      >
        {comment.authorInitials}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "flex items-baseline gap-2 text-sm",
            align === "right" && "justify-end",
          )}
        >
          <span className="font-medium text-foreground">
            {comment.authorName}
          </span>
          <span className="text-muted-foreground">{comment.createdAt}</span>
        </div>
        <div className="text-base text-foreground">{comment.body}</div>
      </div>
    </div>
  );
}

function CommentDraft({
  onSubmit,
  onCancel,
  align,
}: {
  onSubmit: (body: string) => void;
  onCancel: () => void;
  align: "left" | "right";
}) {
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
        setValue("");
      }}
      className={cn(
        "flex w-full max-w-[90%] items-center gap-2 rounded-lg border border-primary/30 bg-card px-3 py-1.5 shadow-sm",
        align === "right" && "flex-row-reverse",
      )}
    >
      <MessageSquarePlus
        className={cn(
          "size-4 shrink-0 text-primary",
          align === "right" && "order-1",
        )}
      />
      <input
        type="text"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder="Add a coaching comment…"
        className="flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel"
        className="flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
      <button
        type="submit"
        disabled={!value.trim()}
        aria-label="Submit comment"
        className={cn(
          "flex size-6 items-center justify-center rounded-md transition-colors",
          value.trim()
            ? "cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
            : "cursor-not-allowed bg-muted text-muted-foreground",
        )}
      >
        <CornerDownLeft className="size-3.5" />
      </button>
    </form>
  );
}

function ActivityRow({
  activity,
  comments,
  isDimmed,
  drafting,
  onOpenDraft,
  onCloseDraft,
  onAddComment,
}: {
  activity: Activity;
  comments: Comment[];
  isDimmed: boolean;
  drafting: boolean;
  onOpenDraft: () => void;
  onCloseDraft: () => void;
  onAddComment: (body: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const active = hovered || drafting;
  return (
    <div
      className={cn(
        "mt-3 transition-opacity duration-300",
        isDimmed && "opacity-30",
      )}
    >
      <div
        className="group relative cursor-pointer"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={onOpenDraft}
      >
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <div
            className={cn(
              "flex items-center gap-2 px-2 text-sm text-muted-foreground transition-all duration-150",
              active && "-translate-y-px text-foreground",
            )}
          >
            <span>{activity.text}</span>
            <span>·</span>
            <span className="font-mono">{activity.createdAt}</span>
          </div>
          <div className="h-px flex-1 bg-border" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDraft();
            }}
            aria-label="Comment on activity"
            className={cn(
              "flex size-6 items-center justify-center rounded-md text-muted-foreground transition-all duration-150",
              active
                ? "opacity-100 hover:bg-accent hover:text-foreground"
                : "opacity-0 pointer-events-none",
            )}
          >
            <MessageSquarePlus className="size-3.5" />
          </button>
        </div>
      </div>
      {(comments.length > 0 || drafting) && (
        <div className="mt-2 flex flex-col items-center gap-1.5">
          {comments.map((cmt) => (
            <CommentCard key={cmt.id} comment={cmt} align="left" />
          ))}
          {drafting && (
            <CommentDraft
              onSubmit={onAddComment}
              onCancel={onCloseDraft}
              align="left"
            />
          )}
        </div>
      )}
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
  const scoreHue: Hue =
    score >= 90 ? "green" : score >= 75 ? "teal" : score >= 60 ? "yellow" : "purple";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
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

function CategoryCard({
  category,
  citationCount,
  active,
  dimmed,
  isPulsing,
  onSelect,
}: {
  category: SampleCategory;
  citationCount: number;
  active: boolean;
  dimmed: boolean;
  isPulsing: boolean;
  onSelect: () => void;
}) {
  const hue = HUE[CATEGORY_HUE[category.id]];
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "group relative w-full cursor-pointer overflow-hidden rounded-lg border px-3 py-2.5 text-left transition-all duration-200",
          active
            ? cn(hue.bgSoft, hue.border, "shadow-sm")
            : "border-transparent bg-transparent hover:bg-accent/50",
          dimmed && "opacity-50",
          isPulsing && cn("animate-pulse", hue.bgSoft),
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-2 left-0 w-1 rounded-r-full transition-all duration-200",
            hue.bg,
            active ? "opacity-100" : "opacity-0 group-hover:opacity-60",
          )}
        />
        <div className="flex items-center justify-between gap-2 pl-2">
          <span
            className={cn(
              "truncate text-base font-medium",
              active ? hue.textDark : "text-foreground",
            )}
          >
            {category.name}
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
          <span>
            {citationCount} cited
            {citationCount !== category.highlightedMessageIds.length && (
              <span className={cn("ml-1 font-medium", hue.textDark)}>
                ({citationCount > category.highlightedMessageIds.length
                  ? "+"
                  : ""}
                {citationCount - category.highlightedMessageIds.length})
              </span>
            )}
          </span>
        </div>
      </button>
    </li>
  );
}

function CategoryScore({
  category,
  hue,
}: {
  category: SampleCategory;
  hue: (typeof HUE)[Hue];
}) {
  if (category.scaleType === "binary") {
    return (
      <span
        className={cn(
          "shrink-0 rounded-md px-2 py-0.5 text-sm font-medium",
          hue.bgSoft,
          hue.textDark,
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
              ? cn(hue.text, "fill-current")
              : "text-border",
          )}
        />
      ))}
    </span>
  );
}
