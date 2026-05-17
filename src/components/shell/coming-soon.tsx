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
        <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/40 px-5 py-6 text-sm text-muted-foreground">
          Coming in phase 2.
        </div>
      </main>
    </>
  );
}
