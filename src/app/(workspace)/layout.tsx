import { PrimaryNav } from "@/components/shell/primary-nav";
import { GlobalDrawer } from "@/components/shared/global-drawer";
import { RecentPageTracker } from "@/components/shared/recent-page-tracker";
import { ToastProvider } from "@/components/shared/toast";
import { SidebarProvider } from "@/components/shell/sidebar-context";
import { SearchProvider } from "@/components/shell/search-context";
import { ViewsProvider } from "@/lib/views/provider";

export const dynamic = "force-dynamic";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <SearchProvider>
        <ViewsProvider>
          <ToastProvider>
            <div className="flex min-h-screen">
              <PrimaryNav />
              <div className="flex-1 flex min-w-0">{children}</div>
              <GlobalDrawer />
              <RecentPageTracker />
            </div>
          </ToastProvider>
        </ViewsProvider>
      </SearchProvider>
    </SidebarProvider>
  );
}
