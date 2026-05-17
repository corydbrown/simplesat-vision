import {
  SecondaryNav,
  ViewsGroup,
} from "@/components/shell/secondary-nav";
import { ViewNavLink } from "@/components/shell/nav-link";
import { db, schema } from "@/db/client";
import { RESPONSE_VIEWS } from "@/lib/views";

export default async function ResponsesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const total = await db.$count(schema.responses);
  return (
    <div className="flex flex-1 min-w-0">
      <SecondaryNav title="Responses" count={total.toLocaleString()}>
        <ViewsGroup label="Views">
          {RESPONSE_VIEWS.map((v) => (
            <ViewNavLink
              key={v.id}
              href={v.id === "all" ? "/responses" : `/responses?view=${v.id}`}
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
