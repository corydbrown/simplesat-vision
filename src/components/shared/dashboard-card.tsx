import { Card, CardContent } from "@/components/ui/card";

export function DashboardCard({
  title,
  trailing,
  children,
}: {
  title: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="py-1">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-base font-medium text-foreground">{title}</h3>
          {trailing}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
