import { notFound } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { DetailActions } from "@/components/shared/detail-actions";
import { CoachingEvalFooter } from "@/components/coaching/coaching-eval-footer";
import { CoachingTicket } from "@/components/coaching/coaching-ticket";
import { CoachingTicketHeader } from "@/components/coaching/coaching-ticket-header";
import { ConfigureScorecardItem } from "@/components/coaching/configure-scorecard-item";
import { RescoreWithPicker } from "@/components/coaching/rescore-with-picker";
import { getCoachingDetail } from "@/db/queries/coaching";
import { listEvaluationsForTicket } from "@/db/queries/evaluations";
import { listLiveScorecardsForPicker } from "@/db/queries/scorecards";

export default async function CoachingDetailPage(
  props: PageProps<"/coaching/[evaluationId]">,
) {
  const { evaluationId } = await props.params;
  const detail = await getCoachingDetail(evaluationId);
  if (!detail) notFound();

  const [versions, liveScorecards] = await Promise.all([
    listEvaluationsForTicket(detail.ticket.id),
    listLiveScorecardsForPicker(),
  ]);

  const crumbLabel =
    detail.ticket.externalId ?? detail.ticket.id;

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Coaching", href: "/coaching" },
          { label: crumbLabel },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <RescoreWithPicker
              ticketId={detail.ticket.id}
              scorecards={liveScorecards}
              currentScorecardId={detail.evaluation.scorecard.id}
            />
            <DetailActions
              entityHref={`/coaching/${detail.evaluation.id}`}
              extraItems={<ConfigureScorecardItem />}
            />
          </div>
        }
      />
      <main className="px-14 py-10">
        <CoachingTicketHeader detail={detail} versions={versions} />
        <CoachingTicket detail={detail} />
        <CoachingEvalFooter evaluation={detail.evaluation} />
      </main>
    </>
  );
}
