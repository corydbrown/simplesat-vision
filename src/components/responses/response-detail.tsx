import { Check, Star } from "lucide-react";
import { ChannelPill } from "@/components/tickets/channel-pill";
import { StatusPill } from "@/components/tickets/status-pill";
import {
  CustomerPill,
  TeamMemberPill,
  TicketPill,
} from "@/components/shared/entity-pill";
import type { ResponseDetail } from "@/db/queries/responses";
import { formatDateTime } from "@/lib/format";
import type {
  Channel,
  SurveyAnswer,
  TicketStatus,
} from "@/db/schema";

function PropertyRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[160px_1fr] items-center gap-4 py-1.5 text-sm">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function StarRating({ value, scale }: { value: number; scale: number }) {
  const stars = Array.from({ length: scale }, (_, i) => i + 1);
  return (
    <div className="inline-flex items-center gap-0.5">
      {stars.map((n) => (
        <Star
          key={n}
          size={18}
          className={
            n <= value
              ? "fill-amber-400 text-amber-400"
              : "fill-zinc-200 text-zinc-200"
          }
        />
      ))}
      <span className="ml-2 text-sm tabular-nums text-muted-foreground">
        {value}/{scale}
      </span>
    </div>
  );
}

function AnswerBlock({ answer }: { answer: SurveyAnswer }) {
  return (
    <div className="rounded-md border border-border bg-background px-4 py-3">
      <div className="text-xs text-muted-foreground">{answer.question}</div>
      <div className="mt-2">
        {answer.type === "rating" && (
          <StarRating value={answer.value} scale={answer.scale} />
        )}
        {answer.type === "multi-choice" && (
          <div className="flex flex-wrap gap-1.5">
            {answer.options.map((opt) => {
              const active = opt === answer.value;
              return (
                <span
                  key={opt}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${
                    active
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200 font-medium"
                      : "bg-muted text-muted-foreground ring-transparent"
                  }`}
                >
                  {active && <Check size={11} />}
                  {opt}
                </span>
              );
            })}
          </div>
        )}
        {answer.type === "multi-select" && (
          <div className="flex flex-wrap gap-1.5">
            {answer.value.length === 0 ? (
              <span className="text-sm text-muted-foreground">
                Nothing selected
              </span>
            ) : (
              answer.value.map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200"
                >
                  <Check size={11} />
                  {v}
                </span>
              ))
            )}
            {answer.value.length > 0 && (
              <span className="text-xs text-muted-foreground self-center">
                of {answer.options.length} options
              </span>
            )}
          </div>
        )}
        {answer.type === "comment" && (
          <blockquote className="border-l-2 border-border pl-3 text-sm text-foreground/80">
            &ldquo;{answer.value}&rdquo;
          </blockquote>
        )}
      </div>
    </div>
  );
}

export function ResponseDetailBody({
  response,
}: {
  response: ResponseDetail;
}) {
  const tone =
    response.rating <= 2
      ? "text-red-600"
      : response.rating === 3
        ? "text-amber-600"
        : "text-emerald-600";

  return (
    <main className="px-8 py-6">
      <div className="mb-1 font-mono text-xs text-muted-foreground">
        {response.id}
      </div>
      <div className="flex items-baseline gap-3">
        <h1 className={`text-2xl font-semibold tracking-tight ${tone}`}>
          {response.rating}/{response.scale}
        </h1>
        <span className="text-sm text-muted-foreground capitalize">
          {response.surveyType} response
        </span>
        <span className="text-muted-foreground/60">·</span>
        <span className="text-sm text-muted-foreground tabular-nums">
          {formatDateTime(response.respondedAt)}
        </span>
      </div>

      <div className="mt-6 divide-y divide-border rounded-md border border-border bg-background">
        <div className="px-5 py-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Properties
          </h2>
        </div>
        <div className="px-5 py-2">
          <PropertyRow label="Ticket">
            {response.ticket ? (
              <TicketPill
                id={response.ticket.id}
                subject={response.ticket.subject}
                size="md"
              />
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </PropertyRow>
          <PropertyRow label="Customer">
            {response.customer ? (
              <CustomerPill
                id={response.customer.id}
                name={response.customer.name}
                size="md"
              />
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </PropertyRow>
          <PropertyRow label="Agent">
            {response.agent ? (
              <TeamMemberPill
                id={response.agent.id}
                name={response.agent.name}
                avatarColor={response.agent.avatarColor}
                size="md"
              />
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </PropertyRow>
          {response.ticket && (
            <>
              <PropertyRow label="Ticket status">
                <StatusPill status={response.ticket.status as TicketStatus} />
              </PropertyRow>
              <PropertyRow label="Channel">
                <ChannelPill channel={response.ticket.channel as Channel} />
              </PropertyRow>
            </>
          )}
          <PropertyRow label="Survey type">
            <span className="text-sm uppercase">{response.surveyType}</span>
          </PropertyRow>
          <PropertyRow label="Scale">
            <span className="text-sm tabular-nums">1 - {response.scale}</span>
          </PropertyRow>
          <PropertyRow label="Responded">
            <span className="text-sm tabular-nums">
              {formatDateTime(response.respondedAt)}
            </span>
          </PropertyRow>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Survey answers
        </h2>
        <div className="mt-3 space-y-3">
          {response.answers.length === 0 ? (
            <div className="rounded-md border border-dashed border-border px-5 py-4 text-sm text-muted-foreground">
              No structured answers.
            </div>
          ) : (
            response.answers.map((a, i) => <AnswerBlock key={i} answer={a} />)
          )}
        </div>
      </section>
    </main>
  );
}
