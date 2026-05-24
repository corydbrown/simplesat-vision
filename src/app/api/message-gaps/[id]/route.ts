import { NextResponse } from "next/server";
import {
  CADENCE_THRESHOLDS_SECONDS,
  getMessageGaps,
} from "@/db/queries/message-gaps";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gaps = await getMessageGaps(id);
  return NextResponse.json({
    ticketId: id,
    thresholds: CADENCE_THRESHOLDS_SECONDS,
    count: gaps.length,
    gaps,
  });
}
