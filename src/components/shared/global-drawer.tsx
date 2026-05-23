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
  TeamMemberDetail,
  TeamMemberListRow,
} from "@/db/queries/team-members";
import type { ResponseDetail, ResponseListRow } from "@/db/queries/responses";
import type { SurveyDetail, SurveyRow } from "@/db/queries/surveys";
import type { QaEvaluationView } from "@/db/queries/qa-evaluations";

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
      data: { ticket: TicketDetail; evaluation: QaEvaluationView | null };
    }
  | {
      entity: "team-member";
      data: {
        member: TeamMemberDetail;
        memberRow: TeamMemberListRow;
        tickets: TicketsRow[];
        responses: ResponseListRow[];
        histogram: { rating: number; count: number }[];
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

  // The block below reads and writes a ref during render and drives state
  // transitions via render-phase setState. This is intentional — the early
  // return on `!active` (further down) happens before any effect runs, so
  // a useEffect-based capture would unmount the drawer before its exit
  // animation could play. See CLAUDE.md "Don't reach for useEffect for
  // the drawer close animation".
  /* eslint-disable react-hooks/refs */
  // Open→close transition: capture the exit snapshot synchronously so
  // the early return below doesn't fire before we can paint the
  // outgoing drawer.
  if (!currentKey && prevParsedKey.current && !exiting) {
    const prevKey = prevParsedKey.current;
    const idx = prevKey.indexOf(":");
    if (idx > 0) {
      setExiting({
        entity: prevKey.slice(0, idx) as DrawerEntity,
        id: prevKey.slice(idx + 1),
        payload,
      });
    }
  }
  // If we're back to fully closed (no parsed, no exiting), reset the
  // open-anim flag for the next time the drawer opens.
  if (!currentKey && !exiting && isOpenAnim) {
    setIsOpenAnim(false);
  }
  // Reopen during a pending exit: cancel the exit snapshot so the open
  // animation isn't fighting the close timeout.
  if (currentKey && exiting) {
    setExiting(null);
  }
  // Drive the close animation as soon as an exit snapshot exists.
  // The cleanup timeout that clears the snapshot stays in an effect.
  if (exiting && isOpenAnim) {
    setIsOpenAnim(false);
  }
  prevParsedKey.current = currentKey;
  /* eslint-enable react-hooks/refs */

  // Trigger open animation on the frame after mount.
  useEffect(() => {
    if (!parsed) return;
    const raf = requestAnimationFrame(() => setIsOpenAnim(true));
    return () => cancelAnimationFrame(raf);
  }, [parsed]);

  // Clear the exit snapshot once the close transition has completed.
  useEffect(() => {
    if (!exiting) return;
    const t = window.setTimeout(() => setExiting(null), 220);
    return () => window.clearTimeout(t);
  }, [exiting]);

  const active = parsed
    ? { entity: parsed.entity, id: parsed.id }
    : exiting
      ? { entity: exiting.entity, id: exiting.id }
      : null;
  if (!active) return null;

  const close = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("drawer");
    next.delete("dt");
    const qs = next.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const renderPayload = payload ?? (exiting?.payload ?? null);

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
            evaluation={renderPayload.data.evaluation}
            inDrawer
          />
        ) : renderPayload.entity === "team-member" ? (
          <TeamMemberDetailBody
            member={renderPayload.data.member}
            memberRow={renderPayload.data.memberRow}
            tickets={renderPayload.data.tickets}
            responses={renderPayload.data.responses}
            histogram={renderPayload.data.histogram}
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
