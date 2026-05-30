import { PrimaryNav } from "@/components/shell/primary-nav";
import { GlobalDrawer } from "@/components/shared/global-drawer";
import { RecentPageTracker } from "@/components/shared/recent-page-tracker";
import { Toaster } from "@/components/ui/sonner";
import { SidebarProvider } from "@/components/shell/sidebar-context";
import { SearchProvider } from "@/components/shell/search-context";
import { ViewsProvider } from "@/lib/views/provider";
import { WorkspaceProvider } from "@/lib/workspace-context";
import { CustomFieldsProvider } from "@/lib/properties/custom-fields-context";
import {
  getCustomerCustomFields,
  getTeamMemberCustomFields,
} from "@/lib/properties/custom-fields-provider";
import { DEMO_WORKSPACE_ID, getActiveWorkspaceId } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolve the active workspace once here and fan the custom-field defs +
  // tier visibility out to every client consumer via context. Bloom returns
  // its curated arrays (no query); other workspaces derive defs from their own
  // data. `showTier` gates the loyalty-tier column + the seeded tier views.
  const workspaceId = await getActiveWorkspaceId();
  const showTier = workspaceId === DEMO_WORKSPACE_ID;
  const [customer, teamMember] = workspaceId
    ? await Promise.all([
        getCustomerCustomFields(workspaceId),
        getTeamMemberCustomFields(workspaceId),
      ])
    : [[], []];

  return (
    <SidebarProvider>
      <WorkspaceProvider workspaceId={workspaceId}>
        <CustomFieldsProvider value={{ customer, teamMember, showTier }}>
          <ViewsProvider showTier={showTier}>
            <SearchProvider>
              <div className="flex min-h-screen">
                <PrimaryNav />
                <div className="flex-1 flex min-w-0">{children}</div>
                <GlobalDrawer />
                <RecentPageTracker />
              </div>
              <Toaster />
            </SearchProvider>
          </ViewsProvider>
        </CustomFieldsProvider>
      </WorkspaceProvider>
    </SidebarProvider>
  );
}
