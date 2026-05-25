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
  TeamMemberQaRollup,
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
  // Hold the last-shown payload through the exit animation so the closing
  // drawer keeps painting its content (instead of flashing to a skeleton).
  // We only refresh the snapshot when the URL points to a new entity —
  // never when it goes to null. Radix Dialog handles the unmount timing.
  const [snapshot, setSnapshot] = useState<{
    key: string;
    payload: DrawerData | null;
    error: boolean;
  } | null>(null);

  if (currentKey && snapshot?.key !== currentKey) {
    const cached = cache.get(currentKey) ?? null;
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
        setSnapshot((s) =>
          s?.key === currentKey
            ? { key: currentKey, payload: next, error: false }
            : s,
        );
      })
      .catch(() => {
        if (myId !== requestId.current) return;
        setSnapshot((s) =>
          s?.key === currentKey ? { ...s, error: true } : s,
        );
      });
  }, [parsed, currentKey]);

  // Nothing has ever been shown — don't mount Dialog at all.
  if (!snapshot) return null;

  const active = parsed ?? parseDrawerParam(snapshot.key);
  if (!active) return null;

  const close = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("drawer");
    next.delete("dt");
    const qs = next.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const renderPayload = snapshot.payload;
  const error = snapshot.error;

  return (
    <DetailDrawer
      fullPageHref={fullPagePath(active.entity, active.id)}
      open={!!parsed}
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
