import {
  CustomerPill,
  TeamMemberPill,
  TicketPill,
} from "@/components/shared/entity-pill";
import { EvaluationStatusPill } from "@/components/coaching/evaluation-status-pill";
import { QaScoreBadge } from "@/components/shared/qa-score-badge";
import { VersionPicker } from "@/components/coaching/version-picker";
import type { CoachingDetail } from "@/db/queries/coaching";
import type { EvaluationVersionRow } from "@/db/queries/evaluations";

/** Server-rendered header block for the coaching detail page — ticket
 *  metadata + evaluation status. Sits above the interactive CoachingTicket
 *  client component. */
export function CoachingTicketHeader({
  detail,
  versions,
}: {
  detail: CoachingDetail;
  versions: EvaluationVersionRow[];
}) {
  const { ticket, evaluation } = detail;

  return (
    <header className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <TicketPill
          id={ticket.id}
          externalId={ticket.helpdeskExternalId}
          size="sm"
        />
        <VersionPicker
          currentEvaluationId={evaluation.id}
          versions={versions}
          size="sm"
        />
        <span>·</span>
        <span className="capitalize">{ticket.channel}</span>
        <span>·</span>
        <span className="capitalize">{ticket.priority} priority</span>
        <span>·</span>
        <span className="capitalize">{ticket.status}</span>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        {ticket.subject}
      </h1>
      <div className="flex flex-wrap items-center gap-3 text-base text-muted-foreground">
        {ticket.customer && (
          <span className="flex items-center gap-2">
            <CustomerPill
              id={ticket.customer.id}
              name={ticket.customer.name}
              size="md"
            />
            {ticket.customer.tier && (
              <span className="rounded-md bg-yellow-lighter px-1.5 py-0.5 text-sm font-medium capitalize text-yellow-darker">
                {ticket.customer.tier} tier
              </span>
            )}
          </span>
        )}
        {ticket.assignee && (
          <span className="inline-flex items-center gap-2">
            <span>handled by</span>
            <TeamMemberPill
              id={ticket.assignee.id}
              name={ticket.assignee.name}
              avatarColor={ticket.assignee.avatarColor}
              size="md"
            />
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-2">
          <QaScoreBadge
            score={evaluation.overallScore}
            status={evaluation.status}
            size="md"
          />
          <EvaluationStatusPill status={evaluation.status} size="md" />
        </span>
      </div>
    </header>
  );
}

