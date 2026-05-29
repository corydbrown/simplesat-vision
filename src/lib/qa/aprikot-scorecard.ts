import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db/client";
import {
  assertCodeDefinedScorecardWeights,
  installCodeDefinedScorecard,
  type CodeDefinedScorecard,
  type InstalledScorecard,
} from "@/lib/qa/scorecard-spec";

/**
 * Aprikot Support Rubric — Pronto Marketing's production QA rubric, installed
 * onto `wks_pronto` alongside IQS so Tim's coaching queue speaks the language
 * his managers already use.
 *
 * Source: `reference_docs/Aprikot rating criteria - SUPPORT Rubric.csv` for
 * structure + `reference_docs/Aprikot Scoring Guide.md` for band semantics.
 * Aprikot's native 1-10 scale collapses to our 1-5 likert: 1-2→1, 3-4→2,
 * 5-6→3, 7-8→4, 9-10→5. Each criterion is weighted 10% (10 criteria × 10 =
 * 100). No autofail criteria — Aprikot doesn't define any.
 */
export const APRIKOT_SCORECARD: CodeDefinedScorecard = {
  name: "Aprikot Support Rubric",
  enabled: true,
  version: 1,
  // Aprikot has no autofail criteria, but the snapshot column is non-null;
  // mirror the PRD default so the value is consistent with IQS.
  autoFailFloor: 30,
  scoringPhilosophy:
    "If team members meet expectations in a certain category, they should not score above 7-8 on Aprikot's 1-10 scale (which collapses to 4 on our 1-5 scale). Higher scores are reserved for exceptional performance and excellent problem solving / time management. It is absolutely fine for scores to overlap across criteria because of the impact that one action in one criterion has on the rest.",
  bandDescriptors: [
    "Serious errors that have to be corrected/escalated or have resulted in client action.",
    "Major errors that go against established standards.",
    "Mediocre performance or missing out on one or two factors.",
    "Meets expectations and upholds good practices.",
    "Going above and beyond what is expected — excellent results and problem solving.",
  ],
  domainContext:
    "Pronto Marketing: outsourced web support for SMB clients. Tickets are typically site changes, DNS / hosting issues, integration questions. Clients range from technical to non-technical.",
  toneExpectations:
    "Match the client's register — formal when they're formal, casual otherwise. Avoid macro overuse that feels impersonal. Keep messaging short and clear without unnecessary explanation.",
  categories: [
    {
      name: "Communication",
      description:
        "Clarity, plain-language explanation, and grasping the client's perspective. Did the team member make themselves understood without forcing the client to do interpretation work?",
      weightPercent: 30,
      scaleType: "likert_5",
      isAutofail: false,
      criteria: [
        {
          text: "How well did the team member provide a brief, clear message without unnecessary explanation?",
          anchor5:
            "Crisp opening, answered every question the client raised, and the client moved straight to confirming — no follow-up clarifications needed.",
          anchor3:
            "Generally understandable but rough edges — a couple of phrases the client had to re-read, or one question left dangling that the client picked up later.",
          anchor1:
            "Reply lacked clarity, prompted the client to ask for clarification, or kicked off unnecessary back-and-forth that a clearer first message would have prevented.",
          weightPercent: 10,
        },
        {
          text: "How well did the team member use plain English, and clearly explain any technical terms?",
          anchor5:
            "Tuned the technical depth to the client — plain English where the client was non-technical, qualified jargon with a one-line explanation where it appeared, and set clear expectations for what would happen next.",
          anchor3:
            "Used a technical term or two without context, or under-explained where the client clearly needed a why; the client got there but had to fill in some gaps.",
          anchor1:
            "Threw technical terms (DNS, Cloudflare, hosting plumbing) at a non-technical client without explanation, leading to confusion or a wrong-turn decision.",
          weightPercent: 10,
        },
        {
          text: "How well did the team member grasp the client's message and perspective?",
          anchor5:
            "Pulled in prior context and historical knowledge of the client, identified the real underlying problem (even when the client's stated cause was off), and tied the answer back to what the client was actually trying to accomplish.",
          anchor3:
            "Addressed the surface request but missed a secondary issue the client mentioned, or didn't dig into the underlying cause when it would have helped.",
          anchor1:
            "Misread the client's objective, leading to frustrating back-and-forth and clarifications that could have been avoided by reading more carefully up front.",
          weightPercent: 10,
        },
      ],
    },
    {
      name: "Efficiency",
      description:
        "Moving the ticket to resolution in the fewest reasonable steps and the right tempo. Did the conversation feel like it was being driven, or drifting?",
      weightPercent: 20,
      scaleType: "likert_5",
      isAutofail: false,
      criteria: [
        {
          text: "How well did the team member manage the ticket efficiently in as few steps as possible?",
          anchor5:
            "Drove the ticket to resolution efficiently even as the client kept supplying new information — each reply moved things meaningfully forward.",
          anchor3:
            "Resolved but with an extra round-trip or two that a tighter first reply could have avoided.",
          anchor1:
            "Multiple unnecessary back-and-forths because the team member didn't understand or address the request fully on the first pass; could have been one reply.",
          weightPercent: 10,
        },
        {
          text: "How well did the team member reply to messages and provide updates in a timely manner?",
          anchor5:
            "Quick action on the first reply, regular proactive updates while work was in progress, and the team member followed up when they were waiting on the client.",
          anchor3:
            "Generally on time but slipped once — a delayed reply or a missing update during a wait — without surfacing it to the client.",
          anchor1:
            "Missed SLA, blew a committed deadline without notice, or left the client waiting without any update.",
          weightPercent: 10,
        },
      ],
    },
    {
      name: "Customer Service",
      description:
        "How the team member made the client feel — empathy under pressure, focus on what the client actually needs, and a tone that matches the moment.",
      weightPercent: 30,
      scaleType: "likert_5",
      isAutofail: false,
      criteria: [
        {
          text: "Did the team member show awareness of and address the client's concerns?",
          anchor5:
            "Read the client's emotional state accurately and matched it — urgency when they were worried, gentle education when they were confused, push-back with care when the request would have hurt them.",
          anchor3:
            "Polite and responsive but didn't visibly acknowledge what the client was feeling — felt transactional rather than reassuring.",
          anchor1:
            "Brushed past an error the client flagged in our own work, or rushed to close the ticket without addressing the worry the client expressed.",
          weightPercent: 10,
        },
        {
          text: "How well did the team member focus on the needs, wants, and expectations of the client?",
          anchor5:
            "Identified the primary need, managed expectations actively, and proactively raised adjacent items the client would have wanted to know about but didn't ask for.",
          anchor3:
            "Met the literal request but didn't shape the reply around what the client was actually trying to accomplish; missed an opportunity to make it more client-friendly.",
          anchor1:
            "Ignored a stated need or expectation, or delivered what we thought the client wanted instead of what they actually asked for, leading to a poor experience.",
          weightPercent: 10,
        },
        {
          text: "How well did the team member show good customer service (or appropriate tone) throughout the ticket?",
          anchor5:
            "Tone tracked the client throughout — formal when they were formal, warmer when they were chatty — and stayed balanced even when the situation was tense.",
          anchor3:
            "Tone was off by a notch — overly formal with a casual client, or stiff with someone who started friendly — but never veered into a problem.",
          anchor1:
            "Heavy macro reuse made the reply feel impersonal, or the tone was mismatched / inconsistent enough that the client would have felt it.",
          weightPercent: 10,
        },
      ],
    },
    {
      name: "Resolution",
      description:
        "Whether the issue was actually solved, and whether the team member found ways to be helpful beyond the literal ask.",
      weightPercent: 20,
      scaleType: "likert_5",
      isAutofail: false,
      criteria: [
        {
          text: "How well did the team member resolve or escalate the issue?",
          anchor5:
            "Resolved every issue the client raised, confirmed completion explicitly with them, and (when needed) escalated cleanly with full context.",
          anchor3:
            "Resolved the primary issue but missed a secondary one the client mentioned, leaving the client to ask again in a follow-up message.",
          anchor1:
            "Incorrect use of a macro and didn't see the resolution through to completion, or escalated when the team member could have solved it themselves.",
          weightPercent: 10,
        },
        {
          text: "How well did the team member focus on solutions and alternatives rather than limitations?",
          anchor5:
            "Solved the issue and added a relevant piece of context or follow-up the client didn't ask for but clearly benefited from.",
          anchor3:
            "Helped but stopped at the line — pointed the client at how they could do the task themselves instead of just doing it when that would have been the better move.",
          anchor1:
            "Defaulted to limitations or a hand-off without first attempting to find a workable solution for the client.",
          weightPercent: 10,
        },
      ],
    },
  ],
};

assertCodeDefinedScorecardWeights(APRIKOT_SCORECARD, "APRIKOT_SCORECARD");

/**
 * Idempotent install of the Aprikot scorecard for a workspace. If a scorecard
 * with the same name already exists (live, not archived), skips the insert
 * and returns `{ skipped: true, scorecardId }`. Otherwise installs a fresh
 * copy and returns the new ids.
 *
 * LLM-context fields are not re-synced on skip — if the rubric needs to be
 * refreshed in place, archive the existing row and re-run.
 */
export type InstallAprikotResult =
  | ({ skipped: false } & InstalledScorecard)
  | { skipped: true; scorecardId: string };

export async function installAprikotScorecard(
  workspaceId: string,
  options: { createdAt?: Date } = {},
): Promise<InstallAprikotResult> {
  const [existing] = await db
    .select({ id: schema.scorecards.id })
    .from(schema.scorecards)
    .where(
      and(
        eq(schema.scorecards.workspaceId, workspaceId),
        eq(schema.scorecards.name, APRIKOT_SCORECARD.name),
        isNull(schema.scorecards.archivedAt),
      ),
    )
    .limit(1);
  if (existing) {
    return { skipped: true, scorecardId: existing.id };
  }

  const installed = await installCodeDefinedScorecard(
    workspaceId,
    APRIKOT_SCORECARD,
    options,
  );
  return { skipped: false, ...installed };
}
