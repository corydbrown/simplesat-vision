/**
 * Render the EXACT LLM scoring prompt for a real ticket, for pasting into the
 * Anthropic Console Workbench to iterate on the prompt.
 *
 * It reuses the production loader (`scoreAndPersistTicket`) by injecting a
 * capture provider that grabs the assembled `ScoringInput` and throws BEFORE
 * any DB write runs. So this is strictly READ-ONLY against whatever database
 * the env points at — run it with prod creds in `.env.local` and it renders
 * the prompt for a real prod ticket without writing anything.
 *
 * Usage (env must be loaded — npm/tsx do NOT read .env.local automatically):
 *   set -a && source .env.local && set +a && \
 *     npx tsx --conditions=react-server scripts/render-scoring-prompt.ts <ticketId> [--scorecard <id>] [--json]
 *
 *   --scorecard <id>  Score against a specific scorecard (defaults to the
 *                     workspace's resolution chain, same as the live app).
 *   --json            Emit the raw `client.messages.create(...)` payload
 *                     instead of the human-readable blocks.
 */
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { scoreAndPersistTicket } from "@/lib/qa/scoring/persist";
import {
  buildSystemPrompt,
  buildToolSchema,
  buildUserPrompt,
} from "@/lib/qa/scoring/prompt";
import type {
  ScoringInput,
  ScoringOutput,
  ScoringProvider,
} from "@/lib/qa/scoring/types";

const MODEL = process.env.LLM_MODEL ?? "claude-opus-4-7";
const MAX_TOKENS = 4096;

/** Sentinel: carries the captured input up through scoreAndPersistTicket. */
class CapturedInput extends Error {
  constructor(public readonly input: ScoringInput) {
    super("captured");
  }
}

/** A provider that captures the assembled ScoringInput and aborts before the
 *  real model call — so the production loader runs verbatim but nothing is
 *  scored or written. */
class CaptureProvider implements ScoringProvider {
  readonly name = "capture";
  async scoreConversation(input: ScoringInput): Promise<ScoringOutput> {
    throw new CapturedInput(input);
  }
}

function parseArgs(argv: string[]) {
  const ticketId = argv.find((a) => !a.startsWith("--"));
  const scIdx = argv.indexOf("--scorecard");
  const scorecardId = scIdx >= 0 ? argv[scIdx + 1] : undefined;
  const asJson = argv.includes("--json");
  return { ticketId, scorecardId, asJson };
}

async function main() {
  const { ticketId, scorecardId, asJson } = parseArgs(process.argv.slice(2));
  if (!ticketId) {
    console.error(
      "Usage: tsx --conditions=react-server scripts/render-scoring-prompt.ts <ticketId> [--scorecard <id>] [--json]",
    );
    process.exit(1);
  }

  // The loader is workspace-scoped; resolve the ticket's workspace first.
  const [row] = await db
    .select({ workspaceId: schema.tickets.workspaceId })
    .from(schema.tickets)
    .where(eq(schema.tickets.id, ticketId))
    .limit(1);
  if (!row) {
    console.error(`Ticket "${ticketId}" not found in the connected database.`);
    process.exit(1);
  }

  let input: ScoringInput;
  try {
    await scoreAndPersistTicket({
      ticketId,
      workspaceId: row.workspaceId,
      provider: new CaptureProvider(),
      scorecardId,
    });
    console.error(
      "Capture provider did not fire — scoreAndPersistTicket returned without scoring. Aborting (nothing rendered).",
    );
    process.exit(1);
    return;
  } catch (err) {
    if (!(err instanceof CapturedInput)) throw err; // surfaces precondition errors verbatim
    input = err.input;
  }

  const system = buildSystemPrompt(input);
  const user = buildUserPrompt(input);
  const toolSchema = buildToolSchema(input.scorecard.categories);

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system,
          tools: [
            {
              name: "record_evaluation",
              description:
                "Record the structured QA evaluation of this support conversation against the supplied scorecard.",
              input_schema: toolSchema,
            },
          ],
          tool_choice: { type: "tool", name: "record_evaluation" },
          messages: [{ role: "user", content: user }],
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  const rule = "=".repeat(76);
  process.stdout.write(
    [
      rule,
      `RENDERED SCORING PROMPT`,
      `ticket=${input.ticket.id}  scorecard=${input.scorecard.name} (v${input.scorecard.version})  model=${MODEL}`,
      rule,
      "",
      "########## SYSTEM ##########",
      "",
      system,
      "",
      "########## USER (messages[0].content) ##########",
      "",
      user,
      "",
      "########## TOOL record_evaluation · input_schema (tool_choice forces this tool) ##########",
      "",
      JSON.stringify(toolSchema, null, 2),
      "",
      rule,
      "Workbench: paste SYSTEM into the system field, USER as a user message,",
      "add a tool `record_evaluation` with the schema above, force it via tool_choice.",
      "Re-run with --json for the exact messages.create payload.",
      rule,
      "",
    ].join("\n"),
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
