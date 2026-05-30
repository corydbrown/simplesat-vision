"use client";

import { useMemo, useRef } from "react";
import {
  CoachingTicket,
  type CoachingTicketHandle,
} from "@/components/coaching/coaching-ticket";
import { buildMessageMentionSource } from "@/lib/mentions/message-source";
import type { CoachingDetail } from "@/db/queries/coaching";
import type { FeedbackEntry } from "@/lib/qa/feedback/actions";
import { FeedbackSection } from "./feedback-section";

/**
 * Client wrapper that renders the conversation + the reviewer-feedback section
 * together so they can share a ref. The page is a Server Component and can't
 * hold the ref or pass a click handler across the RSC boundary; this thin
 * client component owns both, letting a "Message N" mention clicked inside
 * feedback scroll-and-flash the message up in the conversation.
 *
 * The mention source + number↔id map are derived here from `detail.messages`
 * (the same data the conversation uses), so feedback mentions stay in lockstep
 * with the conversation's numbering.
 */
export function EvaluationBody({
  detail,
  showFeedback,
  evaluationId,
  myFeedback,
  otherFeedback,
}: {
  detail: CoachingDetail;
  showFeedback: boolean;
  evaluationId: string;
  myFeedback: FeedbackEntry | null;
  otherFeedback: FeedbackEntry[];
}) {
  const ticketRef = useRef<CoachingTicketHandle | null>(null);

  const mentionSources = useMemo(
    () => [buildMessageMentionSource(detail.messages)],
    [detail.messages],
  );

  const messageIdByNumber = useMemo(() => {
    const m = new Map<number, string>();
    detail.messages.forEach((msg, i) => m.set(i + 1, msg.id));
    return m;
  }, [detail.messages]);

  return (
    <>
      <CoachingTicket ref={ticketRef} detail={detail} />
      {showFeedback && (
        <FeedbackSection
          evaluationId={evaluationId}
          myFeedback={myFeedback}
          otherFeedback={otherFeedback}
          mentionSources={mentionSources}
          messageIdByNumber={messageIdByNumber}
          onJumpToMessage={(id) => ticketRef.current?.jumpToMessage(id)}
        />
      )}
    </>
  );
}
