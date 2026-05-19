"use client";

import { Frown, Meh, Smile, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CompanyPill, TicketPill, TeamMemberPill } from "@/components/shared/entity-pill";
import { Tag } from "@/components/shared/tag";
import type { ResponseListRow } from "@/db/queries/responses";
import { formatRelative } from "@/lib/format";

// Twitter/Slack-feed-style card for one response. Click anywhere on the
// card (except inner links) opens the response in the drawer. Mirrors the
// row-click pattern used in EntityTable.

export function ResponseFeedCard({ row }: { row: ResponseListRow }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("a, button, [role='button']")) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    const next = new URLSearchParams(searchParams.toString());
    next.set("drawer", `response:${row.id}`);
    next.delete("dt");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const standalonePath = `/responses/${row.id}`;

  return (
    <article
      onClick={handleClick}
      className="group cursor-pointer rounded-lg border border-border bg-background px-5 py-4 transition-colors hover:border-foreground/15 hover:bg-accent/30"
    >
      <header className="flex items-start gap-3">
        <SentimentAvatar rating={row.rating} scale={row.scale} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 text-sm">
            {row.customerName ? (
              <span className="truncate font-medium text-foreground">
                {row.customerName}
              </span>
            ) : (
              <span className="text-muted-foreground">Anonymous</span>
            )}
            {row.customerCompany && (
              <>
                <span className="text-muted-foreground">at</span>
                <CompanyPill name={row.customerCompany} />
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums">{formatRelative(row.respondedAt)}</span>
          <Link
            href={standalonePath}
            aria-label="Open response in full page"
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-muted-foreground/50 opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
          >
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </header>

      {row.comment && (
        <p className="mt-3 text-base text-foreground/90 leading-relaxed line-clamp-4">
          {row.comment}
        </p>
      )}

      <footer className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        {row.ticketId && (
          <TicketPill
            id={row.ticketId}
            externalId={row.ticketExternalId}
            subject={row.ticketSubject ?? undefined}
          />
        )}
        {row.teamMemberId && row.teamMemberName && row.teamMemberAvatarColor && (
          <TeamMemberPill
            id={row.teamMemberId}
            name={row.teamMemberName}
            avatarColor={row.teamMemberAvatarColor}
          />
        )}
        <FeedTags answers={row.answers} />
      </footer>
    </article>
  );
}

// Sentiment avatar — colored circle with a face icon. Tone follows the
// customer-rating threshold convention used elsewhere in the app.
function SentimentAvatar({ rating, scale }: { rating: number; scale: number }) {
  const normalized = rating / scale;
  const config =
    normalized > 0.7
      ? { Icon: Smile, bg: "bg-emerald-100", color: "text-emerald-600" }
      : normalized > 0.4
        ? { Icon: Meh, bg: "bg-amber-100", color: "text-amber-600" }
        : { Icon: Frown, bg: "bg-red-100", color: "text-red-600" };
  return (
    <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${config.bg}`}>
      <config.Icon className={config.color} size={26} strokeWidth={2} />
      <span
        className={`absolute -bottom-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-background px-1 text-[10px] font-semibold tabular-nums ${config.color}`}
      >
        {rating}
      </span>
    </div>
  );
}

// Render multi-select answers as tag pills (categories like
// "Problem resolution", "Timeliness"). Other answer types are already
// reflected in the rating + comment.
function FeedTags({
  answers,
}: {
  answers: ResponseListRow["answers"];
}) {
  const tags: string[] = [];
  for (const a of answers) {
    if (a.type === "multi-select" && Array.isArray(a.value)) {
      tags.push(...a.value);
    } else if (a.type === "multi-choice" && typeof a.value === "string") {
      tags.push(a.value);
    }
  }
  if (tags.length === 0) return null;
  return (
    <>
      {tags.map((t) => (
        <Tag key={t}>{t}</Tag>
      ))}
    </>
  );
}
