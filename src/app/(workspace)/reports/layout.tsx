export const dynamic = "force-dynamic";

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex flex-1 flex-col min-w-0">{children}</div>;
}
