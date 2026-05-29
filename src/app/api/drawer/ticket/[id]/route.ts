import { NextResponse } from "next/server";
import { listLiveScorecardsForPicker } from "@/db/queries/scorecards";
import { getTicketById } from "@/db/queries/tickets";
import { getActiveWorkspaceDetails } from "@/db/queries/workspaces";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // SVP-242: scorecards + default flow alongside the ticket so the drawer's
  // Evaluate/Re-evaluate split-button can render without an extra round-trip.
  const [ticket, scorecards, workspace] = await Promise.all([
    getTicketById(id),
    listLiveScorecardsForPicker(),
    getActiveWorkspaceDetails(),
  ]);
  if (!ticket) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({
    ticket,
    scorecards,
    defaultScorecardId: workspace?.defaultScorecardId ?? null,
  });
}
