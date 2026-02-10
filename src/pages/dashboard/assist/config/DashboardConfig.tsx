import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardConfig() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard Configuration</h1>
        <p className="text-muted-foreground">Configure dashboard settings.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dashboard Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">Dashboard configuration options coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}
