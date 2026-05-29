export const dynamic = "force-dynamic";

import { Bot } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Badge } from "@/components/ui/badge";

export default function AgentsPage() {
  return (
    <>
      <Topbar crumbs={[{ label: "Agents" }]} />
      <main className="flex flex-1 flex-col items-center justify-center px-8 py-16">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-lighter text-blue-darker">
            <Bot size={26} />
          </div>
          <div className="mt-5 flex items-center justify-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
            <Badge variant="secondary">Soon</Badge>
          </div>
          <p className="mt-2 text-base text-muted-foreground">
            Agent profiles, performance, and coaching gaps live here. Coming in
            the next phase of the Quality work.
          </p>
        </div>
      </main>
    </>
  );
}
