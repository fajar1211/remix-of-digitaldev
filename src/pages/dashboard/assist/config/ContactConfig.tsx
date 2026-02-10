import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ContactConfig() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Contact Configuration</h1>
        <p className="text-muted-foreground">Manage contact form submissions.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contact Messages</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">Contact form submissions will appear here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
