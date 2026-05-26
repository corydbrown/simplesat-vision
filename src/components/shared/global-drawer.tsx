"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DetailDrawer } from "./detail-drawer";
import { CustomerDetailBody } from "@/components/customers/customer-detail";
import { TicketDetailBody } from "@/components/tickets/ticket-detail";
import { TeamMemberDetailBody } from "@/components/team-members/team-member-detail";
import { ResponseDetailBody } from "@/components/responses/response-detail";
import { SurveyDetailBody } from "@/components/surveys/survey-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { SURVEY_METRIC_LABEL } from "@/lib/properties/surveys";
import {
  recordEntityView,
  type RecentEntityEntry,
} from "@/lib/recent-pages";
import type { CustomerDetail, CustomerListRow } from "@/db/queries/customers";
import type { TicketDetail, TicketsRow } from "@/db/queries/tickets";
import type {
  TeamMemberCoachingFeedItem,
  TeamMemberDetail,
  TeamMemberListRow,
  TeamMemberQaRollup,
  TeamMemberQaSparklines,
  TeamMemberQaTiles,
} from "@/db/queries/team-members";
import type { ResponseDetail, ResponseListRow } from "@/db/queries/responses";
import type { SurveyDetail, SurveyRow } from "@/db/queries/surveys";

export type DrawerEntity =
  | "customer"
  | "ticket"
  | "team-member"
  | "response"
  | "survey";

const ENTITY_PATHS: Record<DrawerEntity, string> = {
  customer: "/customers",
  ticket: "/tickets",
  "team-member": "/team-members",
  response: "/responses",
  survey: "/surveys",
};

export function parseDrawerParam(
  raw: string | null,
): { entity: DrawerEntity; id: string } | null {
  if (!raw) return null;
  const idx = raw.indexOf(":");
  if (idx < 0) return null;
  const entity = raw.slice(0, idx) as DrawerEntity;
  const id = raw.slice(idx + 1);
  if (!id) return null;
  if (
    entity !== "customer" &&
    entity !== "ticket" &&
    entity !== "team-member" &&
    entity !== "response" &&
    entity !== "survey"
  ) {
    return null;
  }
  return { entity, id };
}

export function fullPagePath(entity: DrawerEntity, id: string): string {
  return `${ENTITY_PATHS[entity]}/${id}`;
}

// Revive ISO-8601 date strings into Date objects so existing body components,
// which expect Date types (e.g. ticket.createdAt), keep working without
// touching every consumer.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
function reviveDates<T>(value: unknown): T {
  if (value == null) return value as T;
  if (Array.isArray(value)) {
    return value.map((v) => reviveDates(v)) as unknown as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = reviveDates(v);
    }
    return out as T;
  }
  if (typeof value === "string" && ISO_DATE_RE.test(value)) {
    return new Date(value) as unknown as T;
  }
  return value as T;
}

type DrawerData =
  | {
      entity: "customer";
      data: {
        customer: CustomerDetail;
        customerRow: CustomerListRow;
        tickets: TicketsRow[];
        responses: ResponseListRow[];
      };
    }
  | {
      entity: "ticket";
      data: { ticket: TicketDetail };
    }
  | {
      entity: "team-member";
      data: {
        member: TeamMemberDetail;
        memberRow: TeamMemberListRow;
        tickets: TicketsRow[];
        responses: ResponseListRow[];
        histogram: { rating: number; count: number }[];
        qaRollup: TeamMemberQaRollup;
        qaTiles: TeamMemberQaTiles;
        qaSparklines: TeamMemberQaSparklines;
        coachingFeed: TeamMemberCoachingFeedItem[];
      };
    }
  | {
      entity: "response";
      data: { response: ResponseDetail; responseRow: ResponseListRow };
    }
  | {
      entity: "survey";
      data: {
        survey: SurveyDetail;
        responses: ResponseListRow[];
      };
    };

const cache = new Map<string, DrawerData>();

function buildEntryFromDrawerPayload(
  payload: DrawerData,
): Omit<RecentEntityEntry, "kind" | "viewedAt"> {
  if (payload.entity === "customer") {
    const c = payload.data.customer;
    return {
      entity: "customer",
      id: c.id,
      label: c.name,
      secondary: c.company ?? c.email ?? undefined,
    };
  }
  if (payload.entity === "ticket") {
    const t = payload.data.ticket;
    return {
      entity: "ticket",
      id: t.id,
      label: t.subject ?? `Ticket ${t.helpdeskExternalId ?? t.id}`,
      secondary: t.helpdeskExternalId
        ? `#${t.helpdeskExternalId}`
        : undefined,
    };
  }
  if (payload.entity === "team-member") {
    const m = payload.data.member;
    return {
      entity: "team-member",
      id: m.id,
      label: m.name,
      secondary: m.team ?? undefined,
      avatarColor: m.avatarColor,
    };
  }
  if (payload.entity === "response") {
    const r = payload.data.response;
    const who = r.customer?.name;
    const label = who
      ? `${r.rating}/${r.scale} from ${who}`
      : `${r.rating}/${r.scale} response`;
    const comment = r.comment?.replace(/\s+/g, " ").trim();
    return {
      entity: "response",
      id: r.id,
      label,
      secondary: comment
        ? comment.length > 60
          ? `${comment.slice(0, 60)}…`
          : comment
        : undefined,
    };
  }
  const s = payload.data.survey;
  return {
    entity: "survey",
    id: s.id,
    label: s.name,
    secondary: SURVEY_METRIC_LABEL[s.metric],
  };
}

function surveyRowFromDetail(s: SurveyDetail): SurveyRow {
  return {
    id: s.id,
    name: s.name,
    metric: s.metric,
    channel: s.channel,
    status: s.status,
    scale: s.scale,
    totalResponses: s.stats.totalResponses,
    avgRating: s.stats.avgRating,
    createdAt: s.createdAt,
  };
}

export function GlobalDrawer() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const drawerParam = searchParams.get("drawer");
  const parsed = useMemo(() => parseDrawerParam(drawerParam), [drawerParam]);

  const currentKey = parsed ? `${parsed.entity}:${parsed.id}` : null;
  const [snapshot, setSnapshot] = useState<{
    key: string | null;
    payload: DrawerData | null;
    error: boolean;
  }>({ key: null, payload: null, error: false });

  // Sync from props at render time so an entity swap never paints stale content.
  if (snapshot.key !== currentKey) {
    const cached = currentKey ? cache.get(currentKey) ?? null : null;
    setSnapshot({ key: currentKey, payload: cached, error: false });
  }

  const requestId = useRef(0);
  useEffect(() => {
    if (!parsed || !currentKey) return;
    const cached = cache.get(currentKey);
    if (cached) {
      recordEntityView(buildEntryFromDrawerPayload(cached));
      return;
    }
    const myId = ++requestId.current;
    fetch(`/api/drawer/${parsed.entity}/${parsed.id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((raw) => {
        if (myId !== requestId.current) return;
        const revived = reviveDates<DrawerData["data"]>(raw);
        const next = { entity: parsed.entity, data: revived } as DrawerData;
        cache.set(currentKey, next);
        recordEntityView(buildEntryFromDrawerPayload(next));
        setSnapshot({ key: currentKey, payload: next, error: false });
      })
      .catch(() => {
        if (myId !== requestId.current) return;
        setSnapshot((s) =>
          s.key === currentKey ? { ...s, error: true } : s,
        );
      });
  }, [parsed, currentKey]);

  const payload = snapshot.payload;
  const error = snapshot.error;

  // Animation state machine. The exit snapshot MUST be captured during
  // render — not in an effect — because the early-return on `!active`
  // happens before any effect runs. If we captured in an effect, the
  // drawer would unmount the moment ?drawer= leaves the URL, before
  // the exit animation could play.
  type ExitState = {
    entity: DrawerEntity;
    id: string;
    payload: DrawerData | null;
  };
  const [exiting, setExiting] = useState<ExitState | null>(null);
  // Two-frame mount pattern: when the drawer first appears it renders
  // with isOpenAnim=false (transform = translateX(100%)), then flips
  // to true on the next frame so the CSS transition runs.
  const [isOpenAnim, setIsOpenAnim] = useState(false);
  const prevParsedKey = useRef<string | null>(null);

  // Open→close transition: capture the exit snapshot synchronously during
  // render. The early-return on `!active` below means an effect-based
  // capture would unmount the drawer before its exit animation could play.
  // We also bind the captured value to a local so this render itself sees
  // it (the queued setExiting only takes effect on the next render — if we
  // relied on state alone, this render would compute active=null and React
  // would briefly commit a null tree, unmounting the drawer mid-transition).
  // The close animation drive (setIsOpenAnim(false)) MUST stay in the
  // [exiting] effect below — driving it from render-phase batches it into
  // the same commit as the exit snapshot, collapsing the two-commit cycle
  // the CSS transition needs.
  /* eslint-disable react-hooks/refs */
  let effectiveExiting = exiting;
  if (!currentKey && prevParsedKey.current && !exiting) {
    const prevKey = prevParsedKey.current;
    const idx = prevKey.indexOf(":");
    if (idx > 0) {
      effectiveExiting = {
        entity: prevKey.slice(0, idx) as DrawerEntity,
        id: prevKey.slice(idx + 1),
        payload,
      };
      setExiting(effectiveExiting);
    }
  }
  prevParsedKey.current = currentKey;
  /* eslint-enable react-hooks/refs */

  // Trigger open animation on the frame after mount. Also cancels any
  // pending exit (user re-opens before the exit animation finishes).
  useEffect(() => {
    if (!parsed) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExiting((curr) => (curr ? null : curr));
    const raf = requestAnimationFrame(() => setIsOpenAnim(true));
    return () => cancelAnimationFrame(raf);
  }, [parsed]);

  // Drive close animation + cleanup the exit snapshot after the transition
  // completes. The setIsOpenAnim(false) MUST be here, not in render —
  // running it post-commit gives the browser a paint frame with the drawer
  // still at translateX(0) before flipping to translateX(100%), which is
  // what makes the CSS transition fire.
  useEffect(() => {
    if (!exiting) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsOpenAnim(false);
    const t = window.setTimeout(() => setExiting(null), 220);
    return () => window.clearTimeout(t);
  }, [exiting]);

  const active = parsed
    ? { entity: parsed.entity, id: parsed.id }
    : effectiveExiting
      ? { entity: effectiveExiting.entity, id: effectiveExiting.id }
      : null;
  if (!active) return null;

  const close = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("drawer");
    next.delete("dt");
    const qs = next.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const renderPayload = payload ?? (effectiveExiting?.payload ?? null);

  return (
    <DetailDrawer
      fullPageHref={fullPagePath(active.entity, active.id)}
      isOpen={isOpenAnim}
      onClose={close}
    >
      <div>
        {error ? (
          <div className="px-8 py-6 text-base text-muted-foreground">
            Failed to load.
          </div>
        ) : renderPayload == null ? (
          <div className="px-8 py-6 space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : renderPayload.entity === "customer" ? (
          <CustomerDetailBody
            customer={renderPayload.data.customer}
            customerRow={renderPayload.data.customerRow}
            tickets={renderPayload.data.tickets}
            responses={renderPayload.data.responses}
            inDrawer
          />
        ) : renderPayload.entity === "ticket" ? (
          <TicketDetailBody
            ticket={renderPayload.data.ticket}
            inDrawer
          />
        ) : renderPayload.entity === "team-member" ? (
          <TeamMemberDetailBody
            member={renderPayload.data.member}
            memberRow={renderPayload.data.memberRow}
            tickets={renderPayload.data.tickets}
            responses={renderPayload.data.responses}
            histogram={renderPayload.data.histogram}
            qaRollup={renderPayload.data.qaRollup}
            qaTiles={renderPayload.data.qaTiles}
            qaSparklines={renderPayload.data.qaSparklines}
            coachingFeed={renderPayload.data.coachingFeed}
            inDrawer
          />
        ) : renderPayload.entity === "response" ? (
          <ResponseDetailBody
            response={renderPayload.data.response}
            responseRow={renderPayload.data.responseRow}
            inDrawer
          />
        ) : (
          <SurveyDetailBody
            survey={renderPayload.data.survey}
            surveyRow={surveyRowFromDetail(renderPayload.data.survey)}
            responses={renderPayload.data.responses}
            inDrawer
          />
        )}
      </div>
    </DetailDrawer>
  );
}
