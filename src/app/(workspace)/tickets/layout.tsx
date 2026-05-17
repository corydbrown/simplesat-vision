import {
  SecondaryNav,
  ViewsGroup,
} from "@/components/shell/secondary-nav";
import { ViewNavLink } from "@/components/shell/nav-link";
import { db, schema } from "@/db/client";
import { TICKET_VIEWS } from "@/lib/views";

export default async function TicketsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const total = await db.$count(schema.tickets);
  return (
    <div className="flex flex-1 min-w-0">
      <SecondaryNav title="Tickets" count={total.toLocaleString()}>
        <ViewsGroup label="Views">
          {TICKET_VIEWS.map((v) => (
            <ViewNavLink
              key={v.id}
              href={v.id === "all" ? "/tickets" : `/tickets?view=${v.id}`}
              viewId={v.id}
              label={v.label}
            />
          ))}
        </ViewsGroup>
      </SecondaryNav>
      <div className="flex flex-1 flex-col min-w-0">{children}</div>
    </div>
  );
}
