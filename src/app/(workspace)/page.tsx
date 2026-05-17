import { Topbar } from "@/components/shell/topbar";

export default function HomePage() {
  return (
    <>
      <Topbar crumbs={[{ label: "Home" }]} />
      <main className="px-8 py-10 max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome to Simplesat Vision
        </h1>
        <p className="mt-2 text-muted-foreground">
          A clean-room prototype of the future Simplesat product. Phase 1 ships
          the Tickets view on top of 50,000 seeded Zendesk tickets. Use the
          sidebar to explore.
        </p>
        <div className="mt-8 rounded-lg border border-dashed border-purple-300 bg-purple-50/40 p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-purple-900">
            QA Evaluations
            <span className="rounded bg-purple-200/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-purple-900">
              Soon
            </span>
          </div>
          <p className="mt-1 text-sm text-purple-900/80">
            Independent third-party scoring of every conversation - human or AI
            agent. This is the strategic wedge for the next phase of Simplesat.
          </p>
        </div>
      </main>
    </>
  );
}
