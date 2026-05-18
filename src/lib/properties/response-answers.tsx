"use client";

import { Check, Star } from "lucide-react";
import {
  CustomerPill,
  TeamMemberPill,
  TicketPill,
} from "@/components/shared/entity-pill";
import type { SurveyAnswer } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import type { Property } from "./types";

export type AnswerRow = {
  id: string; // synthetic: responseId + "::" + questionIndex
  responseId: string;
  questionIndex: number;
  answer: SurveyAnswer;
  respondedAt: Date;
  ticketId: string | null;
  ticketSubject: string | null;
  ticketExternalId: string | null;
  customerId: string | null;
  customerName: string | null;
  teamMemberId: string | null;
  teamMemberName: string | null;
  teamMemberAvatarColor: string | null;
};

function AnswerValue({ answer }: { answer: SurveyAnswer }) {
  switch (answer.type) {
    case "rating":
      return (
        <span className="inline-flex items-center gap-1">
          <Star size={11} className="fill-amber-400 text-amber-400" />
          <span className="tabular-nums font-medium">
            {answer.value}/{answer.scale}
          </span>
        </span>
      );
    case "multi-choice":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
          {answer.value}
        </span>
      );
    case "multi-select":
      return (
        <div className="flex flex-wrap gap-1">
          {answer.value.length === 0 ? (
            <span className="text-muted-foreground">-</span>
          ) : (
            answer.value.map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-inset ring-blue-200"
              >
                <Check size={9} />
                {v}
              </span>
            ))
          )}
        </div>
      );
    case "comment":
      return <span className="text-foreground/80">{answer.value}</span>;
  }
}

const TYPE_LABEL: Record<SurveyAnswer["type"], string> = {
  rating: "Rating",
  "multi-choice": "Multi-choice",
  "multi-select": "Multi-select",
  comment: "Comment",
};

export const ANSWER_PROPERTIES: Property<AnswerRow>[] = [
  {
    id: "question",
    label: "Question",
    width: 320,
    group: "Answer",
    alwaysVisible: true,
    cell: (r) => <span className="text-foreground">{r.answer.question}</span>,
  },
  {
    id: "type",
    label: "Type",
    width: 130,
    group: "Answer",
    defaultVisible: true,
    cell: (r) => (
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {TYPE_LABEL[r.answer.type]}
      </span>
    ),
  },
  {
    id: "value",
    label: "Answer",
    width: 360,
    group: "Answer",
    defaultVisible: true,
    cell: (r) => <AnswerValue answer={r.answer} />,
  },
  {
    id: "ticket",
    label: "Ticket",
    width: 200,
    group: "Relations",
    defaultVisible: true,
    cell: (r) =>
      r.ticketId ? (
        <TicketPill
          id={r.ticketId}
          externalId={r.ticketExternalId}
          subject={r.ticketSubject ?? undefined}
        />
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
  },
  {
    id: "customer",
    label: "Customer",
    width: 200,
    group: "Relations",
    defaultVisible: true,
    cell: (r) =>
      r.customerId && r.customerName ? (
        <CustomerPill id={r.customerId} name={r.customerName} />
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
  },
  {
    id: "agent",
    label: "Agent",
    width: 200,
    group: "Relations",
    defaultVisible: true,
    cell: (r) =>
      r.teamMemberId && r.teamMemberName && r.teamMemberAvatarColor ? (
        <TeamMemberPill
          id={r.teamMemberId}
          name={r.teamMemberName}
          avatarColor={r.teamMemberAvatarColor}
        />
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
  },
  {
    id: "responded_at",
    label: "Responded",
    width: 170,
    group: "Activity",
    defaultVisible: true,
    cell: (r) => (
      <span className="tabular-nums text-muted-foreground">
        {formatDateTime(r.respondedAt)}
      </span>
    ),
  },
  {
    id: "response_id",
    label: "Response ID",
    width: 156,
    group: "Identity",
    defaultVisible: false,
    cell: (r) => (
      <span className="font-mono text-xs text-muted-foreground">
        {r.responseId}
      </span>
    ),
  },
];
