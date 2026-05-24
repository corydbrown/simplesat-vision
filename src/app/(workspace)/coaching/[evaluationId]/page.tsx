import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, ClipboardCheck } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { DetailActions } from "@/components/shared/detail-actions";
import { EvaluationStatusPill } from "@/components/coaching/evaluation-status-pill";
import { QaScoreBadge } from "@/components/shared/qa-score-badge";
import { Avatar } from "@/components/shared/avatar";
import { colorFromName, initialsFromName } from "@/lib/color-from-name";
import { formatDate } from "@/lib/format";
import { getEvaluationById } from "@/db/queries/evaluations";

export default async function CoachingDetailPage(
  props: PageProps<"/coaching/[evaluationId]">,
) {
  const { evaluationId } = await props.params;
  const evaluation = await getEvaluationById(evaluationId);
  if (!evaluation) notFound();

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Coaching", href: "/coaching" },
          {
            label: evaluation.ticket
              ? (evaluation.ticket.helpdeskExternalId ?? evaluation.ticket.id)
              : evaluation.id,
          },
        ]}
        actions={
          <DetailActions entityHref={`/coaching/${evaluation.id}`} />
        }
      />
      <div className="px-10 py-7 max-w-3xl">
        <div className="rounded-lg border border-border bg-card p-6 space-y-6">
          <div className="flex items-start gap-3">
            <span className="rounded-md bg-accent/60 p-2 text-icon-coaching">
              <ClipboardCheck size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground">
                Coaching detail · placeholder
              </p>
              <h1 className="text-3xl font-semibold text-foreground">
                {evaluation.ticket?.subject ?? "Untitled evaluation"}
              </h1>
              <p className="mt-1 text-base text-muted-foreground">
                The rich coaching UI ports in Batch 2. This page exists so the
                Bridge work (Batch 3) can link here today.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SummaryRow label="Score">
              <QaScoreBadge
                score={evaluation.overallScore}
                status={evaluation.status}
                size="md"
              />
            </SummaryRow>
            <SummaryRow label="Status">
              <EvaluationStatusPill status={evaluation.status} />
            </SummaryRow>
            <SummaryRow label="Scored agent">
              {evaluation.scoredTeamMember ? (
                <span className="inline-flex items-center gap-2">
                  <Avatar
                    bg={
                      evaluation.scoredTeamMember.avatarColor ??
                      colorFromName(evaluation.scoredTeamMember.name)
                    }
                    initials={initialsFromName(
                      evaluation.scoredTeamMember.name,
                    )}
                    size="sm"
                  />
                  <span className="text-foreground">
                    {evaluation.scoredTeamMember.name}
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">Unassigned</span>
              )}
            </SummaryRow>
            <SummaryRow label="Scorecard">
              <span className="text-foreground">
                {evaluation.scorecard?.name ?? "—"}
              </span>
            </SummaryRow>
            <SummaryRow label="Scored at">
              <span className="text-muted-foreground tabular-nums">
                {formatDate(evaluation.scoredAt)}
              </span>
            </SummaryRow>
            {evaluation.editedAt ? (
              <SummaryRow label="Edited at">
                <span className="text-muted-foreground tabular-nums">
                  {formatDate(evaluation.editedAt)}
                </span>
              </SummaryRow>
            ) : null}
            {evaluation.autoFailed ? (
              <SummaryRow label="Auto-failed">
                <span className="inline-flex items-center rounded-full bg-red-lighter px-2 py-0.5 text-sm font-medium text-red-darker">
                  Yes
                </span>
              </SummaryRow>
            ) : null}
          </div>

          {evaluation.ticket ? (
            <div className="border-t border-border pt-4">
              <p className="text-sm text-muted-foreground mb-2">Linked ticket</p>
              <Link
                href={`/tickets/${evaluation.ticket.id}`}
                className="group inline-flex items-center gap-2 rounded -mx-1 px-1 py-0.5 text-base bg-accent/40 hover:bg-accent"
              >
                <span className="font-mono text-muted-foreground">
                  {evaluation.ticket.helpdeskExternalId ?? evaluation.ticket.id}
                </span>
                <span className="text-foreground">
                  {evaluation.ticket.subject}
                </span>
                <ArrowUpRight
                  size={12}
                  className="text-muted-foreground/60 group-hover:text-foreground"
                />
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div>{children}</div>
    </div>
  );
}
