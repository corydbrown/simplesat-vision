import { PrimaryNav } from "@/components/shell/primary-nav";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <PrimaryNav />
      <div className="flex-1 flex min-w-0">{children}</div>
    </div>
  );
}
