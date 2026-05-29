import { notFound } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { DetailActions } from "@/components/shared/detail-actions";
import { CoachingEvalFooter } from "@/components/coaching/coaching-eval-footer";
import { CoachingTicket } from "@/components/coaching/coaching-ticket";
import { CoachingTicketHeader } from "@/components/coaching/coaching-ticket-header";
import { ConfigureScorecardItem } from "@/components/coaching/configure-scorecard-item";
import { EvalTargetCards } from "@/components/coaching/eval-target-cards";
import { getCoachingDetail } from "@/db/queries/coaching";
import { listEvaluationsForTicket } from "@/db/queries/evaluations";
import { listLiveScorecardsForPicker } from "@/db/queries/scorecards";
import { getActiveWorkspaceDetails } from "@/db/queries/workspaces";
import { getCurrentUser } from "@/lib/auth";
import { listEvaluationFeedback } from "@/lib/qa/feedback/actions";
import { FeedbackSection } from "./feedback-section";

// SVP-243: the `evaluateTicket` action invoked from RescoreWithPicker makes a
// real LLM call (~15-25s) before persisting. Vercel's default function budget
// can cold-start past that; bump the page+action ceiling so the first click
// doesn't burn while a warmer second click sails through.
export const maxDuration = 60;

export default async function EvaluationDetailPage(
  props: PageProps<"/evaluations/[evaluationId]">,
) {
  const { evaluationId } = await props.params;
  const detail = await getCoachingDetail(evaluationId);
  if (!detail) notFound();

  const [versions, liveScorecards, workspace, allFeedback, currentUser] =
    await Promise.all([
      listEvaluationsForTicket(detail.ticket.id),
      listLiveScorecardsForPicker(),
      getActiveWorkspaceDetails(),
      listEvaluationFeedback({ evaluationId }),
      getCurrentUser(),
    ]);

  const myFeedback =
    currentUser != null
      ? allFeedback.find((f) => f.createdBy === currentUser.id) ?? null
      : null;
  const otherFeedback = allFeedback.filter((f) => f.id !== myFeedback?.id);

  const crumbLabel =
    detail.ticket.externalId ?? detail.ticket.id;

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Evaluations", href: "/evaluations" },
          { label: crumbLabel },
        ]}
        actions={
          <DetailActions
            entityHref={`/evaluations/${detail.evaluation.id}`}
            extraItems={<ConfigureScorecardItem />}
          />
        }
      />
      <main className="px-14 py-10">
        <EvalTargetCards
          ticketId={detail.ticket.id}
          activeEvaluationId={detail.evaluation.id}
          versions={versions}
          liveScorecards={liveScorecards}
          defaultScorecardId={workspace?.defaultScorecardId ?? null}
        />
        <CoachingTicketHeader detail={detail} />
        <CoachingTicket detail={detail} />
        {currentUser && (
          <FeedbackSection
            evaluationId={evaluationId}
            myFeedback={myFeedback}
            otherFeedback={otherFeedback}
          />
        )}
        <CoachingEvalFooter evaluation={detail.evaluation} />
      </main>
    </>
  );
}
