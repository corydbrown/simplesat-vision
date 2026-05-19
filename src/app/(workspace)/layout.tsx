import { PrimaryNav } from "@/components/shell/primary-nav";
import { GlobalDrawer } from "@/components/shared/global-drawer";
import { SidebarProvider } from "@/components/shell/sidebar-context";

export const dynamic = "force-dynamic";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <PrimaryNav />
        <div className="flex-1 flex min-w-0">{children}</div>
        <GlobalDrawer />
      </div>
    </SidebarProvider>
  );
}
