"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TeamMemberResolutionRule } from "@/db/schema";
import { setTeamMemberResolutionRule } from "@/lib/workspaces/actions";

type RuleOption = {
  value: TeamMemberResolutionRule;
  label: string;
  description: string;
};

const RULE_OPTIONS: readonly RuleOption[] = [
  {
    value: "assignee",
    label: "Assignee",
    description:
      "The teammate the ticket is currently assigned to. Works for both Zendesk and Intercom.",
  },
  {
    value: "solver",
    label: "Solver",
    description:
      "The teammate who marked the ticket solved. Zendesk only — Intercom tickets fall back to unassigned.",
  },
  {
    value: "most_time_logged",
    label: "Most time logged",
    description:
      "The teammate with the most tracked time on the ticket. Zendesk Time Tracking only — Intercom tickets fall back to unassigned.",
  },
  {
    value: "opened_by",
    label: "Opened by",
    description:
      "The teammate who first responded to the ticket. Works for both Zendesk and Intercom (first admin reply).",
  },
];

type Feedback =
  | { kind: "saved"; reresolved: number }
  | { kind: "error"; message: string };

export function TeamMemberRuleForm({
  initialRule,
  isAdmin,
}: {
  initialRule: TeamMemberResolutionRule;
  isAdmin: boolean;
}) {
  const [rule, setRule] = useState<TeamMemberResolutionRule>(initialRule);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeDescription =
    RULE_OPTIONS.find((o) => o.value === rule)?.description ?? "";

  function handleChange(next: string) {
    const nextRule = next as TeamMemberResolutionRule;
    if (nextRule === rule) return;
    const previous = rule;
    setRule(nextRule);
    setFeedback(null);

    const formData = new FormData();
    formData.set("rule", nextRule);

    startTransition(async () => {
      const result = await setTeamMemberResolutionRule(null, formData);
      if (result.ok) {
        setFeedback({ kind: "saved", reresolved: result.reresolved });
      } else {
        setRule(previous);
        setFeedback({ kind: "error", message: result.error });
      }
    });
  }

  if (!isAdmin) {
    return (
      <p className="text-base text-muted-foreground">
        {RULE_OPTIONS.find((o) => o.value === initialRule)?.label}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Select value={rule} onValueChange={handleChange} disabled={isPending}>
          <SelectTrigger className="h-9 w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RULE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isPending && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            Re-crediting tickets…
          </span>
        )}
        {!isPending && feedback?.kind === "saved" && (
          <span className="flex items-center gap-1.5 text-sm text-green-dark">
            <Check size={14} />
            {feedback.reresolved === 0
              ? "Saved — no tickets changed"
              : `Re-credited ${feedback.reresolved} ticket${feedback.reresolved === 1 ? "" : "s"}`}
          </span>
        )}
        {!isPending && feedback?.kind === "error" && (
          <span className="text-sm text-destructive">{feedback.message}</span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{activeDescription}</p>
    </div>
  );
}
