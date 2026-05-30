import { EmptyState } from "@/components/shared/empty-state";
import { Topbar, type Crumb } from "./topbar";

export function ComingSoonPage({
  crumbs,
  title,
  description,
}: {
  crumbs: Crumb[];
  title: string;
  description: string;
}) {
  return (
    <>
      <Topbar crumbs={crumbs} />
      <main className="px-8 py-10 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-muted-foreground">{description}</p>
        <EmptyState
          description="Coming in phase 2."
          className="mt-6"
        />
      </main>
    </>
  );
}
