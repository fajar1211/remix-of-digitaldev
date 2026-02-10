import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function BlogsConfig() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Blogs Configuration</h1>
        <p className="text-muted-foreground">Manage blog settings and content.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Blog Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">Blog configuration options coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}
