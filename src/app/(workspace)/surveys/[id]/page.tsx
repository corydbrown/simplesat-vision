import { notFound } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { SurveyDetailBody } from "@/components/surveys/survey-detail";
import { DetailActions } from "@/components/shared/detail-actions";
import {
  getSurveyById,
  getSurveyResponses,
  type SurveyRow,
} from "@/db/queries/surveys";

export const dynamic = "force-dynamic";

export default async function SurveyDetailPage(
  props: PageProps<"/surveys/[id]">,
) {
  const { id } = await props.params;

  const survey = await getSurveyById(id);
  if (!survey) notFound();

  const responses = await getSurveyResponses(id, 50);

  const surveyRow: SurveyRow = {
    id: survey.id,
    name: survey.name,
    metric: survey.metric,
    channel: survey.channel,
    status: survey.status,
    scale: survey.scale,
    totalResponses: survey.stats.totalResponses,
    avgRating: survey.stats.avgRating,
    createdAt: survey.createdAt,
  };

  return (
    <>
      <Topbar
        crumbs={[{ label: "Surveys" }, { label: survey.name }]}
        actions={<DetailActions entityHref={`/surveys/${survey.id}`} />}
      />
      <SurveyDetailBody
        survey={survey}
        surveyRow={surveyRow}
        responses={responses}
      />
    </>
  );
}
