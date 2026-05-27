export const dynamic = "force-dynamic";

import { AtSign, Inbox, MessageSquareReply, UserPlus } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Badge } from "@/components/ui/badge";

const PREVIEW = [
  {
    icon: AtSign,
    title: "Mentions",
    body: "When a teammate @-mentions you on a ticket or response.",
  },
  {
    icon: UserPlus,
    title: "Assignments",
    body: "When a conversation lands in your queue or gets reassigned to you.",
  },
  {
    icon: MessageSquareReply,
    title: "New responses",
    body: "When a customer leaves feedback on a survey you're watching.",
  },
];

export default function InboxPage() {
  return (
    <>
      <Topbar crumbs={[{ label: "Inbox" }]} />
      <main className="flex flex-1 flex-col items-center justify-center px-8 py-16">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-purple-lighter text-purple-darker">
            <Inbox size={26} />
          </div>
          <div className="mt-5 flex items-center justify-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              You&rsquo;re all caught up
            </h1>
            <Badge variant="secondary">Soon</Badge>
          </div>
          <p className="mt-2 text-base text-muted-foreground">
            Nothing needs you right now. When it does, it&rsquo;ll show up here
            so you don&rsquo;t have to go hunting for it.
          </p>

          <ul className="mt-8 space-y-3 text-left">
            {PREVIEW.map((item) => {
              const Icon = item.icon;
              return (
                <li
                  key={item.title}
                  className="flex items-start gap-3 rounded-lg border border-border bg-background px-4 py-3"
                >
                  <span className="mt-0.5 text-muted-foreground">
                    <Icon size={18} />
                  </span>
                  <div>
                    <div className="text-base font-medium">{item.title}</div>
                    <div className="text-base text-muted-foreground">
                      {item.body}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </>
  );
}
