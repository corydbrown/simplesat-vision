import {
  SecondaryNav,
  ViewsGroup,
} from "@/components/shell/secondary-nav";
import { ViewNavLink } from "@/components/shell/nav-link";
import { db, schema } from "@/db/client";
import { CUSTOMER_VIEWS } from "@/lib/views";

export default async function CustomersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const total = await db.$count(schema.customers);
  return (
    <div className="flex flex-1 min-w-0">
      <SecondaryNav title="Customers" count={total.toLocaleString()}>
        <ViewsGroup label="Views">
          {CUSTOMER_VIEWS.map((v) => (
            <ViewNavLink
              key={v.id}
              href={v.id === "all" ? "/customers" : `/customers?view=${v.id}`}
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
