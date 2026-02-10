import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LogActivity() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Log Activity</h1>
        <p className="text-muted-foreground">A record of recent actions, updates, and work progress.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity Feed</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">Activity logs will be available soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}
