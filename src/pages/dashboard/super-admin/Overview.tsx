import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SuperAdminOverview() {
  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Quick monitoring of system and business health (UI placeholder — data to follow).
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">—</div>
            <p className="text-xs text-muted-foreground">Will be populated from payment data</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Today’s transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">—</div>
            <p className="text-xs text-muted-foreground">Incoming / successful / failed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Active users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">—</div>
            <p className="text-xs text-muted-foreground">Active in the last 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Active assistants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">—</div>
            <p className="text-xs text-muted-foreground">Active in the last 7 days</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">System status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Payment</span>
              <span className="font-medium">—</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Server</span>
              <span className="font-medium">—</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">API</span>
              <span className="font-medium">—</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Important alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">No data available yet.</div>
            <ul className="mt-3 list-disc pl-5 text-sm text-muted-foreground">
              <li>Failed payments</li>
              <li>Pending refunds</li>
              <li>API anomalies</li>
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
