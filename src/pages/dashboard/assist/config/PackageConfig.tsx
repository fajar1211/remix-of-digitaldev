import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Edit, Plus } from 'lucide-react';

interface Package {
  id: string;
  name: string;
  type: string;
  price: number | null;
  description: string | null;
  features: string[];
  is_active: boolean;
}

export default function PackageConfig() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [editPackage, setEditPackage] = useState<Package | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('packages')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      setPackages(
        (data as any[])?.map((p) => ({
          ...p,
          features: Array.isArray((p as any).features) ? ((p as any).features as string[]) : [],
        })) || []
      );
    } catch (error) {
      console.error('Error fetching packages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editPackage) return;

    // Note: Packages table doesn't allow UPDATE from RLS - this is a placeholder
    toast.info('Package configuration saved (demo mode)');
    setShowDialog(false);
    setEditPackage(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Package Configuration</h1>
        <p className="text-muted-foreground">Manage package pricing and features.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Packages</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading packages...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packages.map((pkg) => (
                  <TableRow key={pkg.id}>
                    <TableCell className="font-medium">{pkg.name}</TableCell>
                    <TableCell className="capitalize">{pkg.type}</TableCell>
                    <TableCell>${pkg.price?.toFixed(2) || '0.00'}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${pkg.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {pkg.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditPackage(pkg);
                          setShowDialog(true);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Package</DialogTitle>
          </DialogHeader>
          {editPackage && (
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={editPackage.name}
                  onChange={(e) => setEditPackage({ ...editPackage, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Price</Label>
                <Input
                  type="number"
                  value={editPackage.price || 0}
                  onChange={(e) => setEditPackage({ ...editPackage, price: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={editPackage.description || ''}
                  onChange={(e) => setEditPackage({ ...editPackage, description: e.target.value })}
                />
              </div>
              <div>
                <Label>Features (one per line)</Label>
                <Textarea
                  value={editPackage.features.join('\n')}
                  onChange={(e) => setEditPackage({ ...editPackage, features: e.target.value.split('\n').filter(f => f.trim()) })}
                  rows={5}
                />
              </div>
              <Button onClick={handleSave} className="w-full">Save Changes</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
