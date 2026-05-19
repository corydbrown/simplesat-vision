import { NextResponse } from "next/server";
import { getSurveyById, getSurveyResponses } from "@/db/queries/surveys";

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
  const responses = await getSurveyResponses(id, 50);
  return NextResponse.json({ survey, responses });
}
