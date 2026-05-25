import { notFound } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { DetailActions } from "@/components/shared/detail-actions";
import { CoachingTicket } from "@/components/coaching/coaching-ticket";
import { CoachingTicketHeader } from "@/components/coaching/coaching-ticket-header";
import { ConfigureScorecardItem } from "@/components/coaching/configure-scorecard-item";
import { getCoachingDetail } from "@/db/queries/coaching";
import { listEvaluationsForTicket } from "@/db/queries/evaluations";

export default async function CoachingDetailPage(
  props: PageProps<"/coaching/[evaluationId]">,
) {
  const { evaluationId } = await props.params;
  const detail = await getCoachingDetail(evaluationId);
  if (!detail) notFound();

  const versions = await listEvaluationsForTicket(detail.ticket.id);

  const crumbLabel =
    detail.ticket.helpdeskExternalId ?? detail.ticket.id;

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Coaching", href: "/coaching" },
          { label: crumbLabel },
        ]}
        actions={
          <DetailActions
            entityHref={`/coaching/${detail.evaluation.id}`}
            extraItems={<ConfigureScorecardItem />}
          />
        }
      />
      <main className="px-14 py-10">
        <CoachingTicketHeader detail={detail} versions={versions} />
        <CoachingTicket detail={detail} />
      </main>
    </>
  );
}
