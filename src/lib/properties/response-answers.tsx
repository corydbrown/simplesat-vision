"use client";

import {
  Calendar,
  Check,
  HelpCircle,
  MessageSquare,
  Star,
  Tag as TagIcon,
  Ticket as TicketIcon,
  User,
  UserCircle2,
} from "lucide-react";
import {
  CustomerPill,
  TeamMemberPill,
  TicketPill,
} from "@/components/shared/entity-pill";
import type { SurveyAnswer } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import { TimestampTooltip } from "@/components/shared/timestamp-tooltip";
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
          <Star size={12} className="fill-yellow text-yellow" />
          <span className="tabular-nums font-medium">
            {answer.value}/{answer.scale}
          </span>
        </span>
      );
    case "multi-choice":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-lighter px-2 py-0.5 text-sm font-medium text-green-darker">
          {answer.value}
        </span>
      );
    case "multi-select":
      return (
        <div className="flex flex-wrap gap-1">
          {answer.value.length === 0 ? (
            <span className="text-muted-foreground/40">—</span>
          ) : (
            answer.value.map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-0.5 rounded-full bg-blue-lighter px-1.5 py-0.5 text-xs font-medium text-blue-darker"
              >
                <Check size={10} />
                {v}
              </span>
            ))
          )}
        </div>
      );
    case "comment":
      return <span className="text-foreground">{answer.value}</span>;
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
    icon: HelpCircle,
    sourceEntity: "Answer",
    alwaysVisible: true,
    kind: "text",
    sortable: true,
    sortValue: (r) => r.answer.question,
    cell: (r) => <span className="text-foreground">{r.answer.question}</span>,
  },
  {
    id: "type",
    label: "Type",
    width: 130,
    icon: TagIcon,
    sourceEntity: "Answer",
    defaultVisible: true,
    kind: "text",
    sortable: true,
    sortValue: (r) => r.answer.type,
    groupable: true,
    groupValue: (r) => r.answer.type,
    groupLabel: (v) => <span>{TYPE_LABEL[v as SurveyAnswer["type"]]}</span>,
    cell: (r) => (
      <span className="text-muted-foreground">
        {TYPE_LABEL[r.answer.type]}
      </span>
    ),
  },
  {
    id: "value",
    label: "Answer",
    width: 360,
    icon: MessageSquare,
    sourceEntity: "Answer",
    defaultVisible: true,
    kind: "component",
    sortable: true,
    sortValue: (r) => {
      const v = r.answer.value;
      if (typeof v === "number" || typeof v === "string") return v;
      // multi-select: sort by joined option list for stability.
      return Array.isArray(v) ? v.join(", ") : null;
    },
    cell: (r) => <AnswerValue answer={r.answer} />,
  },
  {
    id: "ticket",
    label: "Ticket",
    width: 200,
    icon: TicketIcon,
    sourceEntity: "Ticket",
    defaultVisible: true,
    kind: "component",
    sortable: true,
    sortValue: (r) => r.ticketSubject ?? r.ticketExternalId,
    cell: (r) =>
      r.ticketId ? (
        <TicketPill
          id={r.ticketId}
          externalId={r.ticketExternalId}
          subject={r.ticketSubject ?? undefined}
        />
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
  },
  {
    id: "customer",
    label: "Customer",
    width: 200,
    icon: User,
    sourceEntity: "Customer",
    defaultVisible: true,
    kind: "component",
    sortable: true,
    sortValue: (r) => r.customerName,
    groupable: true,
    groupValue: (r) => r.customerName,
    nullGroupLabel: "Anonymous",
    cell: (r) =>
      r.customerId && r.customerName ? (
        <CustomerPill id={r.customerId} name={r.customerName} />
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
  },
  {
    id: "team_member",
    label: "Team member",
    width: 200,
    icon: UserCircle2,
    sourceEntity: "Team member",
    defaultVisible: true,
    kind: "component",
    sortable: true,
    sortValue: (r) => r.teamMemberName,
    groupable: true,
    groupValue: (r) => r.teamMemberName,
    nullGroupLabel: "Unassigned",
    cell: (r) =>
      r.teamMemberId && r.teamMemberName && r.teamMemberAvatarColor ? (
        <TeamMemberPill
          id={r.teamMemberId}
          name={r.teamMemberName}
          avatarColor={r.teamMemberAvatarColor}
        />
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
  },
  {
    id: "responded_at",
    label: "Responded",
    width: 170,
    icon: Calendar,
    sourceEntity: "Answer",
    defaultVisible: true,
    kind: "text",
    sortable: true,
    sortValue: (r) => r.respondedAt,
    cell: (r) => (
      <TimestampTooltip date={r.respondedAt}>
        <span className="tabular-nums text-muted-foreground">
          {formatDateTime(r.respondedAt)}
        </span>
      </TimestampTooltip>
    ),
  },
  {
    id: "response_id",
    label: "Response ID",
    width: 156,
    icon: MessageSquare,
    sourceEntity: "Response",
    defaultVisible: false,
    kind: "text",
    sortable: true,
    sortValue: (r) => r.responseId,
    cell: (r) => (
      <span className="font-mono text-xs text-muted-foreground">
        {r.responseId}
      </span>
    ),
  },
];
