import { Topbar } from "@/components/shell/topbar";
import { ReportBuilder } from "@/components/reports/report-builder";
import { configFromSearchParam } from "@/lib/reports/url-state";

export const dynamic = "force-dynamic";

export default async function ReportsPage(props: PageProps<"/reports">) {
  const sp = await props.searchParams;
  const config = configFromSearchParam(sp.r, "response");

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Reports", href: "/reports" },
          { label: "Untitled report" },
        ]}
      />
      <ReportBuilder initialConfig={config} />
    </>
  );
}
