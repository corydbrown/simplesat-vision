"use client";

import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const HELPER_TEXT =
  "Sent to the LLM at scoring time. Not shown to team members.";

export type LlmContextDraft = {
  scoringPhilosophy: string;
  bandDescriptors: [string, string, string, string, string];
  domainContext: string;
  toneExpectations: string;
};

type Props = {
  value: LlmContextDraft;
  onChange: (patch: Partial<LlmContextDraft>) => void;
};

/** Collapsible section in the scorecard editor that exposes the four
 *  scorecard-level fields the live LLM provider weaves into its scoring
 *  prompt (SVP-228). These never reach team-member-facing UI — only the
 *  scoring provider reads them. */
export function LlmContextEditor({ value, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const filledCount =
    (value.scoringPhilosophy.trim() ? 1 : 0) +
    (value.bandDescriptors.some((b) => b.trim()) ? 1 : 0) +
    (value.domainContext.trim() ? 1 : 0) +
    (value.toneExpectations.trim() ? 1 : 0);

  return (
    <section className="rounded-xl bg-card ring-1 ring-foreground/10">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-accent/30 data-[expanded=true]:bg-transparent"
        data-expanded={expanded}
      >
        <Sparkles size={16} className="shrink-0 text-blue-dark" />
        <div className="min-w-0 flex-1">
          <div className="text-base font-medium text-foreground">
            LLM scoring context
          </div>
          <div className="text-base text-muted-foreground">
            {filledCount === 0
              ? "Empty — the LLM uses defaults"
              : `${filledCount} of 4 sections filled`}
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-muted-foreground transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {expanded && (
        <div className="grid gap-5 border-t border-foreground/10 px-4 py-4">
          <Field
            label="Scoring philosophy"
            helper={HELPER_TEXT}
            value={value.scoringPhilosophy}
            onChange={(v) => onChange({ scoringPhilosophy: v })}
            rows={5}
          />

          <div>
            <label className="text-base text-foreground">
              Band descriptors
            </label>
            <p className="mt-0.5 text-sm text-muted-foreground">
              One short sentence per likert level. {HELPER_TEXT}
            </p>
            <div className="mt-2 grid gap-2">
              {value.bandDescriptors.map((band, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-sm text-muted-foreground">
                    Level {i + 1}
                  </span>
                  <Input
                    value={band}
                    onChange={(e) => {
                      const next = [...value.bandDescriptors] as [
                        string,
                        string,
                        string,
                        string,
                        string,
                      ];
                      next[i] = e.target.value;
                      onChange({ bandDescriptors: next });
                    }}
                    placeholder={`What a level ${i + 1} score looks like`}
                    className="h-8 flex-1"
                  />
                </div>
              ))}
            </div>
          </div>

          <Field
            label="Domain context"
            helper={HELPER_TEXT}
            value={value.domainContext}
            onChange={(v) => onChange({ domainContext: v })}
            rows={4}
          />

          <Field
            label="Tone expectations"
            helper={HELPER_TEXT}
            value={value.toneExpectations}
            onChange={(v) => onChange({ toneExpectations: v })}
            rows={4}
          />
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  helper,
  value,
  onChange,
  rows,
}: {
  label: string;
  helper: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
}) {
  return (
    <div>
      <label className="text-base text-foreground">{label}</label>
      <p className="mt-0.5 text-sm text-muted-foreground">{helper}</p>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="mt-2"
      />
    </div>
  );
}
