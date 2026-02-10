import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { assistStatusBadgeVariant, formatAssistStatusLabel } from '@/lib/assistStatus';

interface Assist {
  id: string;
  name: string;
  email: string;
  status: string | null;
}

export default function AssistList() {
  const [assists, setAssists] = useState<Assist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssists();
  }, []);

  const fetchAssists = async () => {
    try {
      // Fetch user roles with 'assist' role
      const { data: assistRoles, error: rolesError } = await (supabase as any)
        .from('user_roles')
        .select('user_id')
        .eq('role', 'assist');

      if (rolesError) throw rolesError;

      const assistIds = (assistRoles as any[])?.map((r) => r.user_id) || [];

      if (assistIds.length === 0) {
        setAssists([]);
        setLoading(false);
        return;
      }

      // Fetch profiles for assist users
      const { data: profiles, error: profilesError } = await (supabase as any)
        .from('profiles')
        .select('id, name, email, account_status')
        .in('id', assistIds);

      if (profilesError) throw profilesError;

      setAssists((((profiles as any[]) || []) as any[]).map((p) => ({
        id: String(p.id),
        name: String(p.name ?? ""),
        email: String(p.email ?? ""),
        status: (p as any).account_status ?? null,
      })) as any);
    } catch (error) {
      console.error('Error fetching assists:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Assist List</h1>
        <p className="text-muted-foreground">View all marketing assistants.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Assists</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading assists...</p>
          ) : assists.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No assists found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assists.map((assist) => (
                  <TableRow key={assist.id}>
                    <TableCell className="font-medium">{assist.name}</TableCell>
                    <TableCell>{assist.email}</TableCell>
                    <TableCell>
                      <Badge variant={assistStatusBadgeVariant(assist.status)}>
                        {formatAssistStatusLabel(assist.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
