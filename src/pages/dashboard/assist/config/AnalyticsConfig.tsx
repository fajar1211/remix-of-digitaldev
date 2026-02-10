import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AnalyticsConfig() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Analytics</h1>
        <p className="text-muted-foreground">View platform analytics and metrics.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Platform Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">Analytics dashboard coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}
