"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  addReaction,
  attachCategoryToMessage,
  createComment,
  deleteComment,
  editComment,
  removeCategoryFromMessage,
  removeReaction,
} from "@/lib/qa/coaching/actions";
import { editCategoryScore } from "@/lib/qa/actions";
import type {
  CoachingActivityView,
  CoachingCategoryView,
  CoachingDetail,
  CoachingMessageView,
} from "@/db/queries/coaching";
import type {
  CommentRow as CommentRowData,
  CoachingReaction,
  ReactionRow as ReactionRowData,
  ReactionTargetType,
} from "@/lib/qa/coaching";
import { cn } from "@/lib/utils";
import { hueForCategoryOrder, type CoachingHue } from "./colors";
import { MessageBubble, type BubbleCitation } from "./message-bubble";
import { QaOverviewPanel } from "./qa-overview-panel";
import {
  InspectPanel,
  type AddCitationState,
  type InspectFocus,
  type InspectPanelHandle,
} from "./inspect-panel";
import { KeyboardShortcutsDialog } from "./keyboard-shortcuts-dialog";
import type { ReactionAggregate } from "./reaction-row";

type FocusSurface = "convo" | "overview" | "inspect";

export function CoachingTicket({ detail }: { detail: CoachingDetail }) {
  const { evaluation, messages, activities, currentUserId } = detail;

  // ----- optimistic local state -----
  const [comments, setComments] = useState<CommentRowData[]>(detail.comments);
  const [reactions, setReactions] = useState<ReactionRowData[]>(
    detail.reactions,
  );
  /** Per-category highlight override. Once a user attaches/detaches, the
   *  override array becomes the truth for that category until the next page
   *  reload. */
  const [highlightOverrides, setHighlightOverrides] = useState<
    Record<string, string[]>
  >({});
  /** Per-category likert score override after a manager edit. */
  const [scoreOverrides, setScoreOverrides] = useState<
    Record<string, number>
  >({});

  // ----- ui state -----
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [inspectMessageId, setInspectMessageId] = useState<string | null>(null);
  const [inspectFocus, setInspectFocus] = useState<InspectFocus>({
    kind: "add-citation",
  });
  const [addCitation, setAddCitation] = useState<AddCitationState>({
    kind: "closed",
  });
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [focusedCategoryId, setFocusedCategoryId] = useState<string | null>(
    null,
  );
  const [focusedSurface, setFocusedSurface] = useState<FocusSurface>("convo");
  const [activityOn, setActivityOn] = useState(false);
  const [cheatOpen, setCheatOpen] = useState(false);
  const [flashMessageId, setFlashMessageId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);

  const [, startTransition] = useTransition();

  // ----- refs -----
  const messageRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const categoryRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const inspectPanelRef = useRef<InspectPanelHandle | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  // Remembers the last focused message id after Esc-to-deselect so the next
  // arrow keypress resumes from that position rather than jumping to the
  // first/last message.
  const lastFocusedMessageIdRef = useRef<string | null>(null);

  // ----- derived state -----
  const inspectMessage = inspectMessageId
    ? messages.find((m) => m.id === inspectMessageId) ?? null
    : null;

  const messageNumberById = useMemo(() => {
    const m = new Map<string, number>();
    messages.forEach((msg, i) => m.set(msg.id, i + 1));
    return m;
  }, [messages]);

  const activitiesByAfter = useMemo(() => {
    const m = new Map<string, CoachingActivityView[]>();
    for (const a of activities) {
      if (!a.afterMessageId) continue;
      const arr = m.get(a.afterMessageId) ?? [];
      arr.push(a);
      m.set(a.afterMessageId, arr);
    }
    return m;
  }, [activities]);

  const highlightsByCategory = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const c of evaluation.categories) {
      m.set(c.id, highlightOverrides[c.id] ?? c.highlightedMessageIds);
    }
    return m;
  }, [evaluation.categories, highlightOverrides]);

  const citationsByMessage = useMemo(() => {
    const m = new Map<string, BubbleCitation[]>();
    for (const cat of evaluation.categories) {
      const score = scoreOverrides[cat.id] ?? cat.effectiveScore;
      const aiSuggested = cat.humanScore === null && !(cat.id in scoreOverrides);
      const ids = highlightsByCategory.get(cat.id) ?? [];
      for (const msgId of ids) {
        const arr = m.get(msgId) ?? [];
        arr.push({ category: cat, score, aiSuggested });
        m.set(msgId, arr);
      }
    }
    return m;
  }, [evaluation.categories, highlightsByCategory, scoreOverrides]);

  const messageReactionAggregates = useMemo(() => {
    return buildAggregates(reactions, "message", currentUserId, detail);
  }, [reactions, currentUserId, detail]);

  const commentReactionAggregates = useMemo(() => {
    return buildAggregates(reactions, "comment", currentUserId, detail);
  }, [reactions, currentUserId, detail]);

  const commentsByMessage = useMemo(() => {
    const m = new Map<string, CommentRowData[]>();
    for (const c of comments) {
      if (!c.messageId) continue;
      const arr = m.get(c.messageId) ?? [];
      arr.push(c);
      m.set(c.messageId, arr);
    }
    return m;
  }, [comments]);

  const activeCategoryHighlightedSet = useMemo(() => {
    if (!activeCategoryId) return null;
    return new Set(highlightsByCategory.get(activeCategoryId) ?? []);
  }, [activeCategoryId, highlightsByCategory]);

  // ----- mutators (optimistic + server action) -----

  const flashMessage = useCallback((id: string) => {
    const el = messageRefs.current.get(id);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashMessageId(id);
    setTimeout(
      () => setFlashMessageId((curr) => (curr === id ? null : curr)),
      1400,
    );
  }, []);

  const openInspect = useCallback((
    messageId: string,
    options?: { addCitation?: boolean; focusComposer?: boolean },
  ) => {
    setInspectMessageId(messageId);
    setFocusedMessageId(messageId);
    setActiveCategoryId(null);
    setFocusedSurface("inspect");
    setAddCitation(options?.addCitation ? { kind: "picking-category" } : { kind: "closed" });
    if (options?.focusComposer) {
      setInspectFocus({ kind: "composer" });
    } else if (options?.addCitation) {
      setInspectFocus({ kind: "add-citation" });
    } else {
      // Default: land on add-citation row (or first existing citation if any).
      const firstCit = evaluation.categories.find((cat) =>
        (highlightsByCategory.get(cat.id) ?? []).includes(messageId),
      );
      setInspectFocus(
        firstCit
          ? { kind: "citation", categoryId: firstCit.id }
          : { kind: "add-citation" },
      );
    }
  }, [evaluation.categories, highlightsByCategory]);

  const closeInspect = useCallback(() => {
    setInspectMessageId(null);
    setInspectFocus({ kind: "add-citation" });
    setAddCitation({ kind: "closed" });
    setEditingCommentId(null);
    setFocusedSurface("convo");
  }, []);

  function attachCategory(messageId: string, categoryId: string) {
    const prev = highlightsByCategory.get(categoryId) ?? [];
    if (prev.includes(messageId)) return;
    const next = [...prev, messageId];
    setHighlightOverrides((curr) => ({ ...curr, [categoryId]: next }));
    startTransition(async () => {
      try {
        await attachCategoryToMessage({
          evaluationId: evaluation.id,
          categoryId,
          messageId,
        });
      } catch (err) {
        console.error("[coaching] attach failed", err);
        setHighlightOverrides((curr) => ({ ...curr, [categoryId]: prev }));
      }
    });
  }

  function removeCategoryFromMsg(messageId: string, categoryId: string) {
    const prev = highlightsByCategory.get(categoryId) ?? [];
    if (!prev.includes(messageId)) return;
    const next = prev.filter((id) => id !== messageId);
    setHighlightOverrides((curr) => ({ ...curr, [categoryId]: next }));
    startTransition(async () => {
      try {
        await removeCategoryFromMessage({
          evaluationId: evaluation.id,
          categoryId,
          messageId,
        });
      } catch (err) {
        console.error("[coaching] detach failed", err);
        setHighlightOverrides((curr) => ({ ...curr, [categoryId]: prev }));
      }
    });
  }

  function setCitationScore(categoryId: string, score: number) {
    const cat = evaluation.categories.find((c) => c.id === categoryId);
    if (!cat) return;
    const prev = scoreOverrides[categoryId] ?? cat.effectiveScore;
    setScoreOverrides((curr) => ({ ...curr, [categoryId]: score }));
    startTransition(async () => {
      try {
        await editCategoryScore({
          evaluationId: evaluation.id,
          categoryId,
          humanScore: score,
          reason: "Inline score change from coaching surface",
        });
      } catch (err) {
        console.error("[coaching] score change failed", err);
        setScoreOverrides((curr) => ({ ...curr, [categoryId]: prev }));
      }
    });
  }

  function submitComment(body: string, messageId: string) {
    const tmpId = `tmp_${Date.now()}`;
    const now = Date.now();
    const optimistic: CommentRowData = {
      id: tmpId,
      evaluationId: evaluation.id,
      messageId,
      activityId: null,
      parentCommentId: null,
      authorId: currentUserId,
      body,
      createdAt: now,
      updatedAt: now,
    };
    setComments((curr) => [...curr, optimistic]);
    startTransition(async () => {
      try {
        const created = await createComment({
          evaluationId: evaluation.id,
          messageId,
          body,
        });
        setComments((curr) =>
          curr.map((c) => (c.id === tmpId ? created : c)),
        );
      } catch (err) {
        console.error("[coaching] comment failed", err);
        setComments((curr) => curr.filter((c) => c.id !== tmpId));
      }
    });
  }

  function editCommentBody(commentId: string, body: string) {
    const prev = comments.find((c) => c.id === commentId);
    if (!prev) return;
    setComments((curr) =>
      curr.map((c) =>
        c.id === commentId ? { ...c, body, updatedAt: Date.now() } : c,
      ),
    );
    startTransition(async () => {
      try {
        await editComment({ commentId, body });
      } catch (err) {
        console.error("[coaching] edit comment failed", err);
        setComments((curr) =>
          curr.map((c) => (c.id === commentId ? prev : c)),
        );
      }
    });
  }

  function deleteCommentById(commentId: string) {
    const prev = comments.find((c) => c.id === commentId);
    if (!prev) return;
    setComments((curr) => curr.filter((c) => c.id !== commentId));
    setReactions((curr) =>
      curr.filter(
        (r) => !(r.targetType === "comment" && r.targetId === commentId),
      ),
    );
    startTransition(async () => {
      try {
        await deleteComment({ commentId });
      } catch (err) {
        console.error("[coaching] delete comment failed", err);
        setComments((curr) => [...curr, prev]);
      }
    });
  }

  function toggleReactionOn(
    targetType: ReactionTargetType,
    targetId: string,
    emoji: CoachingReaction,
  ) {
    const existing = reactions.find(
      (r) =>
        r.targetType === targetType &&
        r.targetId === targetId &&
        r.authorId === currentUserId &&
        r.emoji === emoji,
    );
    if (existing) {
      setReactions((curr) => curr.filter((r) => r.id !== existing.id));
      startTransition(async () => {
        try {
          await removeReaction({ targetType, targetId, emoji });
        } catch (err) {
          console.error("[coaching] remove reaction failed", err);
          setReactions((curr) => [...curr, existing]);
        }
      });
    } else {
      const tmpId = `tmp_rx_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      const optimistic: ReactionRowData = {
        id: tmpId,
        targetType,
        targetId,
        evaluationId: evaluation.id,
        authorId: currentUserId,
        emoji,
        createdAt: Date.now(),
      };
      setReactions((curr) => [...curr, optimistic]);
      startTransition(async () => {
        try {
          const created = await addReaction({
            targetType,
            targetId,
            evaluationId: evaluation.id,
            emoji,
          });
          setReactions((curr) =>
            curr.map((r) => (r.id === tmpId ? created : r)),
          );
        } catch (err) {
          console.error("[coaching] add reaction failed", err);
          setReactions((curr) => curr.filter((r) => r.id !== tmpId));
        }
      });
    }
  }

  // ----- navigation -----

  const moveConvoFocus = useCallback(
    (delta: 1 | -1) => {
      const ids = messages.map((m) => m.id);
      setFocusedMessageId((curr) => {
        if (!curr) {
          // After Esc-to-deselect, resume from the remembered index instead
          // of jumping to the first/last message.
          const remembered = lastFocusedMessageIdRef.current;
          if (remembered && ids.includes(remembered)) return remembered;
          return delta > 0 ? ids[0] : ids[ids.length - 1];
        }
        const idx = ids.indexOf(curr);
        if (idx < 0) return ids[0];
        const next = Math.max(0, Math.min(ids.length - 1, idx + delta));
        return ids[next];
      });
    },
    [messages],
  );

  const moveCategoryFocus = useCallback(
    (delta: 1 | -1) => {
      const ids = evaluation.categories.map((c) => c.id);
      setFocusedCategoryId((curr) => {
        if (!curr) return delta > 0 ? ids[0] : ids[ids.length - 1];
        const idx = ids.indexOf(curr);
        if (idx < 0) return ids[0];
        const next = Math.max(0, Math.min(ids.length - 1, idx + delta));
        return ids[next];
      });
    },
    [evaluation.categories],
  );

  /** Build the focusable item ladder inside Inspect, in DOM order, so
   *  Up/Down can cycle through it. Citations first, then Add citation (when
   *  available), then the composer. Add citation drops out while the
   *  category/score picker is open — those flows are mouse-driven for V1. */
  const inspectFocusables = useMemo<InspectFocus[]>(() => {
    if (!inspectMessage) return [];
    const cits = citationsByMessage.get(inspectMessage.id) ?? [];
    const items: InspectFocus[] = cits.map((c) => ({
      kind: "citation" as const,
      categoryId: c.category.id,
    }));
    const availableCount =
      evaluation.categories.length -
      new Set(cits.map((c) => c.category.id)).size;
    if (addCitation.kind === "closed" && availableCount > 0) {
      items.push({ kind: "add-citation" });
    }
    items.push({ kind: "composer" });
    return items;
  }, [
    inspectMessage,
    citationsByMessage,
    addCitation,
    evaluation.categories.length,
  ]);

  const moveInspectFocus = useCallback(
    (delta: 1 | -1) => {
      if (inspectFocusables.length === 0) return;
      const sameItem = (a: InspectFocus, b: InspectFocus) => {
        if (a.kind !== b.kind) return false;
        if (a.kind === "citation" && b.kind === "citation") {
          return a.categoryId === b.categoryId;
        }
        return true;
      };
      const idx = inspectFocusables.findIndex((it) =>
        sameItem(it, inspectFocus),
      );
      const start = idx < 0 ? (delta > 0 ? -1 : inspectFocusables.length) : idx;
      const next = (start + delta + inspectFocusables.length) %
        inspectFocusables.length;
      setInspectFocus(inspectFocusables[next]);
    },
    [inspectFocusables, inspectFocus],
  );

  // Smooth-scroll on focused message change.
  useEffect(() => {
    if (!focusedMessageId) return;
    const el = messageRefs.current.get(focusedMessageId);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusedMessageId]);

  // When a category becomes active in overview, auto-scroll first cited
  // message to the top of the viewport so it lands at the user's natural
  // reading position.
  useEffect(() => {
    if (!activeCategoryId) return;
    const ids = highlightsByCategory.get(activeCategoryId) ?? [];
    const firstId = ids[0];
    if (!firstId) return;
    const el = messageRefs.current.get(firstId);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeCategoryId, highlightsByCategory]);

  // Focus the focused category card after right-arrow nav into the QA panel.
  useEffect(() => {
    if (focusedSurface !== "overview" || !focusedCategoryId) return;
    categoryRefs.current.get(focusedCategoryId)?.focus();
  }, [focusedSurface, focusedCategoryId]);

  // Click-outside-sidebar deselects the active category.
  useEffect(() => {
    if (!activeCategoryId) return;
    function onDocClick(e: MouseEvent) {
      const sidebar = sidebarRef.current;
      if (!sidebar) return;
      const path = e.composedPath();
      for (const node of path) {
        if (node === sidebar) return;
      }
      setActiveCategoryId(null);
    }
    const t = window.setTimeout(
      () => document.addEventListener("click", onDocClick),
      0,
    );
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("click", onDocClick);
    };
  }, [activeCategoryId]);

  // Click-outside-inspect closes Inspect. Defer attaching by a tick so the
  // same click that opened Inspect doesn't immediately close it.
  useEffect(() => {
    if (!inspectMessageId) return;
    function onDocClick(e: MouseEvent) {
      const sidebar = sidebarRef.current;
      if (!sidebar) return;
      // Walk composedPath instead of using e.target — a click that triggers a
      // same-tick unmount (e.g. clicking comment delete, which removes the
      // button from the DOM before this handler runs) leaves e.target
      // detached and `sidebar.contains(node)` returns false. composedPath
      // preserves the original ancestor chain even after detachment, so the
      // sidebar containment check stays correct.
      const path = e.composedPath();
      for (const node of path) {
        if (node === sidebar) return;
        if (node instanceof HTMLElement && node.dataset.msgId) return;
      }
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
  }, [inspectMessageId, closeInspect]);

  // ----- keyboard -----

  useEffect(() => {
    function handler(e: globalThis.KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping = tag === "TEXTAREA" || tag === "INPUT";

      if (e.key === "?" && !isTyping) {
        e.preventDefault();
        setCheatOpen((v) => !v);
        return;
      }
      if (cheatOpen) return;

      if (e.key === "Escape") {
        if (addCitation.kind !== "closed") {
          e.preventDefault();
          setAddCitation({ kind: "closed" });
          return;
        }
        if (editingCommentId) {
          e.preventDefault();
          setEditingCommentId(null);
          return;
        }
        if (isTyping) {
          e.preventDefault();
          (target as HTMLElement).blur?.();
          return;
        }
        if (inspectMessageId) {
          e.preventDefault();
          closeInspect();
          return;
        }
        if (activeCategoryId) {
          e.preventDefault();
          setActiveCategoryId(null);
          return;
        }
        if (focusedSurface === "convo" && focusedMessageId) {
          // Return to the unselected "clean" view — but remember the index so
          // the next arrow keypress resumes from here.
          e.preventDefault();
          lastFocusedMessageIdRef.current = focusedMessageId;
          setFocusedMessageId(null);
          return;
        }
        return;
      }

      // Suppress single-letter shortcuts while typing.
      if (isTyping) return;

      // Arrow nav between convo and right column.
      if (e.key === "ArrowRight") {
        if (focusedSurface === "convo") {
          e.preventDefault();
          if (inspectMessageId) {
            setFocusedSurface("inspect");
            // InspectPanel's focus useEffect picks up isActiveSurface and
            // transfers DOM focus to the current inspectFocus item.
          } else {
            setFocusedSurface("overview");
            if (!focusedCategoryId && evaluation.categories[0]) {
              setFocusedCategoryId(evaluation.categories[0].id);
            }
          }
          return;
        }
      }
      if (e.key === "ArrowLeft") {
        if (focusedSurface !== "convo") {
          e.preventDefault();
          setFocusedSurface("convo");
          return;
        }
      }

      // Up/Down navigation — depends on surface.
      if (
        e.key === "ArrowDown" ||
        e.key === "j" ||
        e.key === "J" ||
        e.key === "ArrowUp" ||
        e.key === "k" ||
        e.key === "K"
      ) {
        const delta: 1 | -1 =
          e.key === "ArrowDown" || e.key === "j" || e.key === "J" ? 1 : -1;
        if (focusedSurface === "overview") {
          e.preventDefault();
          moveCategoryFocus(delta);
          return;
        }
        if (focusedSurface === "inspect") {
          e.preventDefault();
          moveInspectFocus(delta);
          return;
        }
        e.preventDefault();
        moveConvoFocus(delta);
        return;
      }

      if (e.key === "Enter") {
        if (focusedSurface === "overview" && focusedCategoryId) {
          e.preventDefault();
          toggleCategoryMute(focusedCategoryId);
          return;
        }
        if (focusedSurface === "convo" && focusedMessageId) {
          e.preventDefault();
          openInspect(focusedMessageId);
          return;
        }
        if (focusedSurface === "inspect" && inspectMessageId) {
          if (inspectFocus.kind === "add-citation") {
            e.preventDefault();
            startAddCitation();
            return;
          }
          if (inspectFocus.kind === "composer") {
            // Let the composer's textarea handle Enter natively.
            return;
          }
          if (inspectFocus.kind === "citation") {
            // Citation rows expand inline when focused; Enter is a no-op here
            // rather than triggering a destructive action.
            e.preventDefault();
            return;
          }
        }
      }

      // Action keys — only relevant when convo is the active surface and
      // there's a focused message.
      if (focusedSurface !== "convo" || !focusedMessageId) return;
      const focused = messages.find((m) => m.id === focusedMessageId);
      if (!focused) return;

      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        openInspect(focusedMessageId, { focusComposer: true });
        return;
      }
      if (e.key === "t" || e.key === "T") {
        if (focused.authorRole !== "agent") return;
        e.preventDefault();
        openInspect(focusedMessageId, { addCitation: true });
        return;
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        // The reaction popover is column-contained; clicking the bubble's
        // ReactionRow's `+` button via DOM keeps the picker logic in one place.
        const el = messageRefs.current.get(focusedMessageId);
        const trigger = el?.querySelector<HTMLButtonElement>(
          '[aria-label="Add reaction"]',
        );
        trigger?.click();
        return;
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    cheatOpen,
    addCitation,
    editingCommentId,
    inspectMessageId,
    activeCategoryId,
    focusedSurface,
    focusedMessageId,
    focusedCategoryId,
    inspectFocus,
    messages,
    evaluation.categories,
    moveConvoFocus,
    moveCategoryFocus,
    moveInspectFocus,
    openInspect,
    closeInspect,
  ]);

  // ----- category mute toggle -----

  function toggleCategoryMute(categoryId: string) {
    setActiveCategoryId((curr) => (curr === categoryId ? null : categoryId));
  }

  // ----- inspect add-citation flow -----

  function startAddCitation() {
    setAddCitation({ kind: "picking-category" });
  }
  function cancelAddCitation() {
    setAddCitation({ kind: "closed" });
  }
  function pickCategory(categoryId: string) {
    if (!inspectMessageId) return;
    const cat = evaluation.categories.find((c) => c.id === categoryId);
    if (!cat) return;
    attachCategory(inspectMessageId, categoryId);
    if (cat.scaleType === "binary") {
      setAddCitation({ kind: "closed" });
    } else {
      setAddCitation({ kind: "picking-score", categoryId });
    }
  }
  function pickScore(score: number) {
    if (!inspectMessageId || addCitation.kind !== "picking-score") return;
    setCitationScore(addCitation.categoryId, score);
    setAddCitation({ kind: "closed" });
    setInspectFocus({
      kind: "citation",
      categoryId: addCitation.categoryId,
    });
  }

  // ----- up-arrow edit last comment -----

  function editLastOwnCommentIfAny() {
    if (!inspectMessageId) return;
    const own = (commentsByMessage.get(inspectMessageId) ?? [])
      .filter((c) => c.authorId === currentUserId)
      .at(-1);
    if (own) setEditingCommentId(own.id);
  }

  // ----- render -----

  return (
    <div className="relative">
      <div className="grid grid-cols-[1fr_380px] gap-6">
        <div className="min-w-0">
          <ActivityToggle
            on={activityOn}
            onChange={() => setActivityOn((v) => !v)}
            onOpenCheat={() => setCheatOpen(true)}
          />

          <div className="mt-4 space-y-3">
            {messages.map((msg) => {
              const cits = citationsByMessage.get(msg.id) ?? [];
              const reacts = messageReactionAggregates.get(msg.id) ?? [];
              const msgComments = commentsByMessage.get(msg.id) ?? [];
              const isFocused =
                focusedSurface === "convo" && focusedMessageId === msg.id;
              const isInspected = inspectMessageId === msg.id;
              const isHovered = hoveredMessageId === msg.id;
              const isCited =
                activeCategoryHighlightedSet?.has(msg.id) ?? false;
              const isDimmed =
                (activeCategoryHighlightedSet !== null && !isCited) ||
                (inspectMessageId !== null && !isInspected);
              const outlineHue: CoachingHue | null = isCited
                ? (() => {
                    const cat = evaluation.categories.find(
                      (c) => c.id === activeCategoryId,
                    );
                    return cat ? hueForCategoryOrder(cat.order) : null;
                  })()
                : null;
              const popupVisible = isFocused || isHovered;
              const activitiesAfter = activityOn
                ? activitiesByAfter.get(msg.id) ?? []
                : [];

              return (
                <div key={msg.id}>
                  <MessageBubble
                    ref={(el) => {
                      messageRefs.current.set(msg.id, el);
                    }}
                    message={msg}
                    messageNumber={messageNumberById.get(msg.id) ?? 0}
                    citations={cits}
                    reactions={reacts}
                    hasComments={msgComments.length > 0}
                    isFocused={isFocused}
                    isInspected={isInspected}
                    isDimmed={isDimmed}
                    isFlashing={flashMessageId === msg.id}
                    outlineHue={outlineHue}
                    popupVisible={popupVisible}
                    onHoverChange={(h) =>
                      setHoveredMessageId(h ? msg.id : null)
                    }
                    onClickBubble={() => openInspect(msg.id)}
                    onClickComment={() =>
                      openInspect(msg.id, { focusComposer: true })
                    }
                    onClickCite={() => {
                      if (msg.authorRole !== "agent") return;
                      openInspect(msg.id, { addCitation: true });
                    }}
                    onClickInspect={() => openInspect(msg.id)}
                    onClickCitationChip={(catId) => {
                      setInspectMessageId(msg.id);
                      setFocusedMessageId(msg.id);
                      setActiveCategoryId(null);
                      setAddCitation({ kind: "closed" });
                      setFocusedSurface("inspect");
                      setInspectFocus({ kind: "citation", categoryId: catId });
                    }}
                    onToggleReaction={(emoji) =>
                      toggleReactionOn("message", msg.id, emoji)
                    }
                  />
                  {activitiesAfter.map((a) => (
                    <ActivityRow
                      key={a.id}
                      activity={a}
                      dimmed={isDimmed && !isInspected}
                    />
                  ))}
                </div>
              );
            })}
            <EndOfConversationRow />
          </div>
        </div>

        <aside className="relative" ref={sidebarRef}>
          <div className="sticky top-14">
            {inspectMessage ? (
              <InspectPanel
                ref={inspectPanelRef}
                key={inspectMessage.id}
                message={inspectMessage}
                messageNumber={
                  messageNumberById.get(inspectMessage.id) ?? 0
                }
                messageNumberById={messageNumberById}
                citations={citationsByMessage.get(inspectMessage.id) ?? []}
                comments={commentsByMessage.get(inspectMessage.id) ?? []}
                reactionsByCommentId={commentReactionAggregates}
                membersById={detail.membersById}
                currentUserId={currentUserId}
                focus={inspectFocus}
                isActiveSurface={focusedSurface === "inspect"}
                addCitation={addCitation}
                allCategories={evaluation.categories}
                editingCommentId={editingCommentId}
                onBack={closeInspect}
                onFocusChange={(focus) => {
                  setInspectFocus(focus);
                  setFocusedSurface("inspect");
                }}
                onJumpToMessage={flashMessage}
                onSetCitationScore={setCitationScore}
                onRemoveCitation={(categoryId) =>
                  removeCategoryFromMsg(inspectMessage.id, categoryId)
                }
                onStartAddCitation={startAddCitation}
                onCancelAddCitation={cancelAddCitation}
                onPickCategory={pickCategory}
                onPickScore={pickScore}
                onSubmitComment={(body) =>
                  submitComment(body, inspectMessage.id)
                }
                onEditComment={editCommentBody}
                onDeleteComment={deleteCommentById}
                onToggleCommentReaction={(commentId, emoji) =>
                  toggleReactionOn("comment", commentId, emoji)
                }
                onEditingDone={() => setEditingCommentId(null)}
                onUpArrowEmptyComposer={editLastOwnCommentIfAny}
              />
            ) : (
              <QaOverviewPanel
                evaluation={{
                  ...evaluation,
                  // Reflect any local score overrides in the displayed score.
                  categories: evaluation.categories.map((c) => ({
                    ...c,
                    effectiveScore: scoreOverrides[c.id] ?? c.effectiveScore,
                    highlightedMessageIds:
                      highlightOverrides[c.id] ?? c.highlightedMessageIds,
                  })),
                }}
                activeCategoryId={activeCategoryId}
                focusedCategoryId={
                  focusedSurface === "overview" ? focusedCategoryId : null
                }
                categoryRefs={categoryRefs}
                onToggleCategory={toggleCategoryMute}
                onFocusCategory={(id) => {
                  setFocusedCategoryId(id);
                  setFocusedSurface("overview");
                }}
              />
            )}
          </div>
        </aside>
      </div>

      <KeyboardShortcutsDialog open={cheatOpen} onOpenChange={setCheatOpen} />
    </div>
  );
}

function ActivityToggle({
  on,
  onChange,
  onOpenCheat,
}: {
  on: boolean;
  onChange: () => void;
  onOpenCheat: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-card/40 px-3 py-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="size-4 text-primary" />
        <span>
          Hover any message for actions.{" "}
          <button
            type="button"
            onClick={onOpenCheat}
            className="cursor-pointer underline-offset-2 hover:underline"
          >
            Press ? for keyboard shortcuts
          </button>
          .
        </span>
      </div>
      <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <span>Show activity</span>
        <Switch checked={on} onCheckedChange={onChange} />
      </label>
    </div>
  );
}

function EndOfConversationRow() {
  return (
    <div className="flex items-center gap-3 py-1.5 text-sm text-muted-foreground">
      <div className="h-px flex-1 bg-border" />
      <span>End of conversation</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function ActivityRow({
  activity,
  dimmed,
}: {
  activity: CoachingActivityView;
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
      <span>{activity.label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

/** Group reactions by (targetType, targetId) and produce display aggregates
 *  with reactor names + a "reactedByMe" flag. Resolved through the member
 *  lookup so we surface names, not bare ids. */
function buildAggregates(
  reactions: ReactionRowData[],
  targetType: ReactionTargetType,
  currentUserId: string,
  detail: CoachingDetail,
): Map<string, ReactionAggregate[]> {
  const out = new Map<string, ReactionAggregate[]>();
  const grouped = new Map<string, Map<CoachingReaction, ReactionRowData[]>>();
  for (const r of reactions) {
    if (r.targetType !== targetType) continue;
    const byEmoji = grouped.get(r.targetId) ?? new Map();
    const arr = byEmoji.get(r.emoji) ?? [];
    arr.push(r);
    byEmoji.set(r.emoji, arr);
    grouped.set(r.targetId, byEmoji);
  }
  for (const [targetId, byEmoji] of grouped) {
    const aggs: ReactionAggregate[] = [];
    for (const [emoji, rows] of byEmoji) {
      aggs.push({
        emoji,
        reactors: rows.map(
          (r) =>
            (r.authorId === currentUserId
              ? "You"
              : detail.membersById[r.authorId]?.name) ?? "Someone",
        ),
        reactedByMe: rows.some((r) => r.authorId === currentUserId),
      });
    }
    out.set(targetId, aggs);
  }
  return out;
}

// Discriminate unused exports — keeps the build clean.
export type { CoachingCategoryView, CoachingMessageView };
