import {
  AlertTriangle,
  ArrowRightLeft,
  Bot,
  ChevronUp,
  Clock,
  Hourglass,
  MessageCircle,
} from "lucide-react";
import type { ComponentType } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TicketSignals } from "@/db/queries/tickets";

// Thresholds at which a numeric signal becomes worth surfacing as a chip on
// the row. Filter sliders can still target any value — chips are about
// visual "what's coachable here?" cues, not parity with the filter editor.
const REASSIGNMENT_CHIP_THRESHOLD = 2;
const QUEUE_WAIT_HOURS_CHIP_THRESHOLD = 1;
const CUSTOMER_REPLY_CHIP_THRESHOLD = 3;
const LONGEST_IDLE_HOURS_CHIP_THRESHOLD = 12;

type SignalChip = {
  key: string;
  icon: ComponentType<{ size?: number }>;
  label: string;
  color: string;
};

function formatHours(n: number): string {
  if (n < 1) return `${Math.round(n * 60)}m`;
  if (n < 24) return `${Math.round(n)}h`;
  return `${Math.round(n / 24)}d`;
}

function deriveChips(signals: TicketSignals): SignalChip[] {
  const chips: SignalChip[] = [];

  if (signals.slaBreached) {
    chips.push({
      key: "sla",
      icon: AlertTriangle,
      label: "SLA breached",
      color: "bg-red-lighter text-red-darker",
    });
  }

  if (signals.escalated) {
    chips.push({
      key: "escalated",
      icon: ChevronUp,
      label: "Escalated",
      color: "bg-yellow-lighter text-yellow-darker",
    });
  }

  if (signals.aiHandoff) {
    chips.push({
      key: "ai-handoff",
      icon: Bot,
      label: "AI handoff",
      color: "bg-teal-lighter text-teal-darker",
    });
  }

  if (signals.hadTransfer) {
    const count = signals.reassignmentCount;
    chips.push({
      key: "transfer",
      icon: ArrowRightLeft,
      label:
        count >= REASSIGNMENT_CHIP_THRESHOLD
          ? `Transferred ${count} times`
          : "Transferred",
      color: "bg-purple-lighter text-purple-darker",
    });
  }

  if (
    signals.queueWaitHours != null &&
    signals.queueWaitHours >= QUEUE_WAIT_HOURS_CHIP_THRESHOLD
  ) {
    chips.push({
      key: "queue-wait",
      icon: Clock,
      label: `Queue wait: ${formatHours(signals.queueWaitHours)}`,
      color: "bg-yellow-lighter text-yellow-darker",
    });
  }

  if (signals.customerReplyCount >= CUSTOMER_REPLY_CHIP_THRESHOLD) {
    chips.push({
      key: "customer-replies",
      icon: MessageCircle,
      label: `${signals.customerReplyCount} customer replies`,
      color: "bg-blue-lighter text-blue-darker",
    });
  }

  if (
    signals.longestIdleHours != null &&
    signals.longestIdleHours >= LONGEST_IDLE_HOURS_CHIP_THRESHOLD
  ) {
    chips.push({
      key: "longest-idle",
      icon: Hourglass,
      label: `Longest idle: ${formatHours(signals.longestIdleHours)}`,
      color: "bg-yellow-lighter text-yellow-darker",
    });
  }

  return chips;
}

export function SignalsCell({ signals }: { signals: TicketSignals }) {
  const chips = deriveChips(signals);
  if (chips.length === 0) {
    return <span className="text-muted-foreground/40">—</span>;
  }

  return (
    <span className="inline-flex items-center gap-1">
      {chips.map((c) => {
        const Icon = c.icon;
        return (
          <Tooltip key={c.key}>
            <TooltipTrigger asChild>
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${c.color}`}
                aria-label={c.label}
              >
                <Icon size={12} />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">{c.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </span>
  );
}
