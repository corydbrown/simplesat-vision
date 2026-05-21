import type { TicketsRow } from "@/db/queries/tickets";

type SurveyState = "responded" | "sent_no_reply" | "not_fired" | "skipped" | "pending";

function deriveState(t: TicketsRow): SurveyState {
  if (t.response) return "responded";
  if (t.surveySentAt) return "sent_no_reply";
  if (t.surveyNotSentReason) return "not_fired";
  if (!t.surveyEligible) return "skipped";
  return "pending";
}

const META: Record<
  SurveyState,
  { glyph: string; label: string; color: string }
> = {
  responded: {
    glyph: "●",
    label: "Responded",
    color: "text-green-dark",
  },
  sent_no_reply: { glyph: "○", label: "Sent, no reply", color: "text-blue" },
  not_fired: { glyph: "⊘", label: "Not fired", color: "text-yellow-dark" },
  skipped: { glyph: "—", label: "Skipped", color: "text-muted-foreground" },
  pending: { glyph: "⏳", label: "Pending", color: "text-yellow-dark" },
};

export function SurveyStateCell({ ticket }: { ticket: TicketsRow }) {
  const state = deriveState(ticket);
  const m = META[state];
  return (
    <span className={`inline-flex items-center gap-1.5 ${m.color}`}>
      <span className="text-base leading-none">{m.glyph}</span>
      <span className="text-sm text-muted-foreground">{m.label}</span>
    </span>
  );
}
