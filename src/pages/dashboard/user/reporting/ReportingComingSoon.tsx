import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReportingComingSoon({ title }: { title: string }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">Coming Soon</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            {title} will be available soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
