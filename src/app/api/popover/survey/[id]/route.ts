import { NextResponse } from "next/server";
import { getSurveyById } from "@/db/queries/surveys";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const survey = await getSurveyById(id);
  if (!survey) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: survey.id,
    name: survey.name,
    metric: survey.metric,
    channel: survey.channel,
    status: survey.status,
    scale: survey.scale,
    totalResponses: survey.stats.totalResponses,
    avgRating: survey.stats.avgRating,
    lastResponseAt:
      survey.stats.lastResponseAt != null
        ? survey.stats.lastResponseAt.toISOString()
        : null,
  });
}
