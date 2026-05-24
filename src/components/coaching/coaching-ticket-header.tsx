import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Avatar } from "@/components/shared/avatar";
import { EvaluationStatusPill } from "@/components/coaching/evaluation-status-pill";
import { QaScoreBadge } from "@/components/shared/qa-score-badge";
import { initialsFromName } from "@/lib/color-from-name";
import type { CoachingDetail } from "@/db/queries/coaching";

/** Server-rendered header block for the coaching detail page — ticket
 *  metadata + evaluation status + linked-ticket affordance. Sits above the
 *  interactive CoachingTicket client component. */
export function CoachingTicketHeader({
  detail,
}: {
  detail: CoachingDetail;
}) {
  const { ticket, evaluation } = detail;

  return (
    <header className="mb-4 space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {ticket.helpdeskExternalId && (
          <span className="font-mono">{ticket.helpdeskExternalId}</span>
        )}
        <span>·</span>
        <span className="capitalize">{ticket.channel}</span>
        <span>·</span>
        <span className="capitalize">{ticket.priority} priority</span>
        <span>·</span>
        <span className="capitalize">{ticket.status}</span>
      </div>
      <h1 className="text-2xl font-semibold leading-snug text-foreground">
        {ticket.subject}
      </h1>
      <div className="flex flex-wrap items-center gap-3 text-base text-muted-foreground">
        {ticket.customer && (
          <span className="flex items-center gap-2">
            <span className="text-foreground">{ticket.customer.name}</span>
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
            <Avatar
              bg={ticket.assignee.avatarColor}
              initials={initialsFromName(ticket.assignee.name)}
              size="sm"
            />
            <span className="text-foreground">{ticket.assignee.name}</span>
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-2">
          <QaScoreBadge
            score={evaluation.overallScore}
            status={evaluation.status}
            size="md"
          />
          <EvaluationStatusPill status={evaluation.status} />
        </span>
      </div>
      <Link
        href={`/tickets/${ticket.id}`}
        className="group inline-flex items-center gap-2 rounded -mx-1 px-1 py-0.5 text-sm bg-accent/40 hover:bg-accent"
      >
        <span className="text-muted-foreground">Open ticket</span>
        <ArrowUpRight
          size={12}
          className="text-muted-foreground/60 group-hover:text-foreground"
        />
      </Link>
    </header>
  );
}

