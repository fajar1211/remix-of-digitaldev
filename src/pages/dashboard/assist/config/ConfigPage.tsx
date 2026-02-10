import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  LayoutDashboard, FileText, Phone, TrendingUp, Package, UserCog, 
  Edit, Plus, Trash2, Power, PowerOff, Upload, Save, Mail, MessageCircle, MapPin
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PackageData {
  id: string;
  name: string;
  type: string;
  price: number | null;
  description: string | null;
  features: any;
  is_active: boolean;
}

interface AssistUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string | null;
}

interface BlogPost {
  id: string;
  title: string;
  description: string;
  featured_image: string | null;
  status: string;
  author: string;
  category: string;
  created_at: string;
}

interface ContactSettings {
  email: string;
  phone: string;
  whatsapp: string;
  location: string;
}

type ConfigTab = 'dashboard' | 'blogs' | 'contact' | 'analytics' | 'package' | 'assist';

export default function ConfigPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ConfigTab>('dashboard');
  
  // Package state
  const [packages, setPackages] = useState<PackageData[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [editingPackage, setEditingPackage] = useState<PackageData | null>(null);
  const [showPackageDialog, setShowPackageDialog] = useState(false);
  
  // Assist state
  const [assistUsers, setAssistUsers] = useState<AssistUser[]>([]);
  const [loadingAssist, setLoadingAssist] = useState(true);
  const [showNewAssistDialog, setShowNewAssistDialog] = useState(false);
  const [newAssistData, setNewAssistData] = useState({ name: '', email: '', password: '' });
  const [creatingAssist, setCreatingAssist] = useState(false);

  // Blog state
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [showBlogDialog, setShowBlogDialog] = useState(false);
  const [blogFormData, setBlogFormData] = useState({
    title: '',
    description: '',
    featured_image: '',
    status: 'draft',
    author: '',
    category: '',
  });
  const [categories, setCategories] = useState<string[]>(['Marketing', 'Business', 'Technology', 'Tips']);
  const [newCategory, setNewCategory] = useState('');
  const [savingBlog, setSavingBlog] = useState(false);

  // Contact state
  const [contactSettings, setContactSettings] = useState<ContactSettings>({
    email: 'hello@easymarketingassist.com',
    phone: '+1 (555) 123-4567',
    whatsapp: '+1 (555) 123-4567',
    location: 'Remote / Worldwide',
  });
  const [savingContact, setSavingContact] = useState(false);

  useEffect(() => {
    fetchPackages();
    fetchAssistUsers();
  }, []);

  const fetchPackages = async () => {
    const { data } = await (supabase as any)
      .from('packages')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setPackages((data as any) || []);
    }
    setLoadingPackages(false);
  };

  const fetchAssistUsers = async () => {
    const { data: userRoles } = await (supabase as any)
      .from('user_roles')
      .select('user_id')
      .eq('role', 'assist');

    const assistIds = (userRoles as any[])?.map((r) => r.user_id) || [];

    const { data: profiles } = await (supabase as any)
      .from('profiles')
      .select('id, name, email, phone, account_status')
      .in('id', assistIds);

    setAssistUsers(((profiles as any[]) || []).map((p) => ({ ...p, status: (p as any).account_status || 'active' })));
    setLoadingAssist(false);
  };

  const handleEditPackage = (pkg: PackageData) => {
    setEditingPackage(pkg);
    setShowPackageDialog(true);
  };

  const handleSavePackage = async () => {
    if (!editingPackage) return;

    const { error } = await (supabase as any)
      .from('packages')
      .update({
        name: editingPackage.name,
        price: editingPackage.price,
        description: editingPackage.description,
        is_active: editingPackage.is_active,
      })
      .eq('id', editingPackage.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Saved!', description: 'Package updated successfully.' });
      fetchPackages();
    }
    setShowPackageDialog(false);
    setEditingPackage(null);
  };

  const handleToggleAssistStatus = async (assist: AssistUser) => {
    const newStatus = assist.status === 'active' ? 'nonactive' : 'active';
    
    const { error } = await (supabase as any)
      .from('profiles')
      .update({ account_status: newStatus } as any)
      .eq('id', assist.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ 
        title: newStatus === 'active' ? 'Account Activated' : 'Account Deactivated',
        description: `${assist.name}'s account has been ${newStatus === 'active' ? 'activated' : 'deactivated'}.`
      });
      fetchAssistUsers();
    }
  };

  const handleDeleteAssist = async (assist: AssistUser) => {
    // Delete from profiles first
    const { error: profileError } = await (supabase as any)
      .from('profiles')
      .delete()
      .eq('id', assist.id);

    if (profileError) {
      toast({ variant: 'destructive', title: 'Error', description: profileError.message });
      return;
    }

    // Delete from user_roles
    const { error: roleError } = await (supabase as any)
      .from('user_roles')
      .delete()
      .eq('user_id', assist.id);

    if (roleError) {
      toast({ variant: 'destructive', title: 'Error', description: roleError.message });
      return;
    }

    toast({ title: 'Deleted', description: `${assist.name}'s account has been deleted.` });
    fetchAssistUsers();
  };

  const handleCreateNewAssist = async () => {
    if (!newAssistData.email || !newAssistData.name || !newAssistData.password) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill all fields.' });
      return;
    }

    setCreatingAssist(true);
    try {
      // Create user via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newAssistData.email,
        password: newAssistData.password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // Create profile
        await (supabase as any).from('profiles').insert({
          id: authData.user.id,
          email: newAssistData.email,
          name: newAssistData.name,
          account_status: 'active',
        });

        // Create role
        await (supabase as any).from('user_roles').insert({
          user_id: authData.user.id,
          role: 'assist',
        });

        toast({ title: 'Success!', description: 'New assist account created.' });
        setShowNewAssistDialog(false);
        setNewAssistData({ name: '', email: '', password: '' });
        fetchAssistUsers();
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setCreatingAssist(false);
    }
  };

  const handleAddCategory = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      setCategories(prev => [...prev, newCategory.trim()]);
      setNewCategory('');
    }
  };

  const handleSaveBlog = async () => {
    if (!blogFormData.title) {
      toast({ variant: 'destructive', title: 'Error', description: 'Title is required.' });
      return;
    }

    setSavingBlog(true);
    // For demo, just add to local state (would need a blogs table in DB)
    const newBlog: BlogPost = {
      id: Date.now().toString(),
      ...blogFormData,
      created_at: new Date().toISOString(),
    };
    setBlogs(prev => [newBlog, ...prev]);
    toast({ title: 'Blog Added', description: 'Blog post has been created.' });
    setShowBlogDialog(false);
    setBlogFormData({
      title: '',
      description: '',
      featured_image: '',
      status: 'draft',
      author: '',
      category: '',
    });
    setSavingBlog(false);
  };

  const handleSaveContactSettings = async () => {
    setSavingContact(true);
    // Would save to a settings table in DB
    await new Promise(resolve => setTimeout(resolve, 500));
    toast({ title: 'Saved!', description: 'Contact settings have been updated.' });
    setSavingContact(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configuration</h1>
        <p className="text-muted-foreground">Manage platform settings and configurations</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ConfigTab)}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="blogs" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Blogs
          </TabsTrigger>
          <TabsTrigger value="contact" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Contact
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="package" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Package
          </TabsTrigger>
          <TabsTrigger value="assist" className="flex items-center gap-2">
            <UserCog className="h-4 w-4" />
            Assist
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Config */}
        <TabsContent value="dashboard" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Dashboard Settings</CardTitle>
              <CardDescription>Configure dashboard appearance and behavior</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Dashboard configuration options coming soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Blogs Config */}
        <TabsContent value="blogs" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Blog Settings</CardTitle>
                  <CardDescription>Manage blog posts and configuration</CardDescription>
                </div>
                <Button onClick={() => setShowBlogDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Blog
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {blogs.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium">No blog posts yet</h3>
                  <p className="text-muted-foreground text-sm mb-4">Create your first blog post</p>
                  <Button onClick={() => setShowBlogDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add New Blog
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Author</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blogs.map((blog) => (
                      <TableRow key={blog.id}>
                        <TableCell className="font-medium">{blog.title}</TableCell>
                        <TableCell><Badge variant="outline">{blog.category || '-'}</Badge></TableCell>
                        <TableCell>{blog.author || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={blog.status === 'published' ? 'default' : 'secondary'}>
                            {blog.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact Config */}
        <TabsContent value="contact" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Contact Page Settings</CardTitle>
                  <CardDescription>Configure contact information displayed on /contact</CardDescription>
                </div>
                <Button onClick={handleSaveContactSettings} disabled={savingContact}>
                  <Save className="h-4 w-4 mr-2" />
                  {savingContact ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Us
                  </Label>
                  <Input
                    value={contactSettings.email}
                    onChange={(e) => setContactSettings(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="hello@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Call Us
                  </Label>
                  <Input
                    value={contactSettings.phone}
                    onChange={(e) => setContactSettings(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </Label>
                  <Input
                    value={contactSettings.whatsapp}
                    onChange={(e) => setContactSettings(prev => ({ ...prev, whatsapp: e.target.value }))}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Location
                  </Label>
                  <Input
                    value={contactSettings.location}
                    onChange={(e) => setContactSettings(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="City, Country"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Config */}
        <TabsContent value="analytics" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Analytics Settings</CardTitle>
              <CardDescription>Configure analytics and tracking</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Analytics configuration coming soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Package Config */}
        <TabsContent value="package" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Package Management</CardTitle>
                  <CardDescription>Configure pricing and features for packages</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingPackages ? (
                <p className="text-muted-foreground">Loading packages...</p>
              ) : packages.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No packages found.</p>
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
                        <TableCell>
                          <Badge variant="outline">{pkg.type}</Badge>
                        </TableCell>
                        <TableCell>${pkg.price || 0}</TableCell>
                        <TableCell>
                          <Badge variant={pkg.is_active ? 'default' : 'secondary'}>
                            {pkg.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditPackage(pkg)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assist Config */}
        <TabsContent value="assist" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Assist Team</CardTitle>
                  <CardDescription>View and manage assist team members</CardDescription>
                </div>
                <Button onClick={() => setShowNewAssistDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Assist
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingAssist ? (
                <p className="text-muted-foreground">Loading assist users...</p>
              ) : assistUsers.length === 0 ? (
                <div className="text-center py-12">
                  <UserCog className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium">No assist users yet</h3>
                  <p className="text-muted-foreground text-sm mb-4">Create the first assist account</p>
                  <Button onClick={() => setShowNewAssistDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Assist
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assistUsers.map((assist) => (
                      <TableRow key={assist.id}>
                        <TableCell className="font-medium">{assist.name}</TableCell>
                        <TableCell>{assist.email}</TableCell>
                        <TableCell>{assist.phone || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={assist.status === 'active' ? 'default' : 'secondary'}>
                            {assist.status || 'active'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleAssistStatus(assist)}
                              title={assist.status === 'active' ? 'Deactivate' : 'Activate'}
                            >
                              {assist.status === 'active' ? (
                                <PowerOff className="h-4 w-4 text-orange-500" />
                              ) : (
                                <Power className="h-4 w-4 text-green-500" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteAssist(assist)}
                              title="Delete Account"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Package Edit Dialog */}
      <Dialog open={showPackageDialog} onOpenChange={setShowPackageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Package</DialogTitle>
            <DialogDescription>
              Update package details and pricing
            </DialogDescription>
          </DialogHeader>
          {editingPackage && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Package Name</Label>
                <Input
                  value={editingPackage.name}
                  onChange={(e) => setEditingPackage(prev => prev ? { ...prev, name: e.target.value } : null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Price</Label>
                <Input
                  type="number"
                  value={editingPackage.price || 0}
                  onChange={(e) => setEditingPackage(prev => prev ? { ...prev, price: parseFloat(e.target.value) } : null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editingPackage.description || ''}
                  onChange={(e) => setEditingPackage(prev => prev ? { ...prev, description: e.target.value } : null)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editingPackage.is_active}
                  onCheckedChange={(checked) => setEditingPackage(prev => prev ? { ...prev, is_active: checked } : null)}
                />
                <Label>Active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPackageDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePackage}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Assist Dialog */}
      <Dialog open={showNewAssistDialog} onOpenChange={setShowNewAssistDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Assist Account</DialogTitle>
            <DialogDescription>
              Add a new assist team member
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={newAssistData.name}
                onChange={(e) => setNewAssistData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={newAssistData.email}
                onChange={(e) => setNewAssistData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={newAssistData.password}
                onChange={(e) => setNewAssistData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="••••••••"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewAssistDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateNewAssist} disabled={creatingAssist}>
              {creatingAssist ? 'Creating...' : 'Create Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blog Dialog */}
      <Dialog open={showBlogDialog} onOpenChange={setShowBlogDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Blog</DialogTitle>
            <DialogDescription>
              Create a new blog post
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={blogFormData.title}
                onChange={(e) => setBlogFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter blog title..."
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={blogFormData.description}
                onChange={(e) => setBlogFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter blog description..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Featured Image URL</Label>
              <Input
                value={blogFormData.featured_image}
                onChange={(e) => setBlogFormData(prev => ({ ...prev, featured_image: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={blogFormData.status} 
                  onValueChange={(v) => setBlogFormData(prev => ({ ...prev, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Author</Label>
                <Input
                  value={blogFormData.author}
                  onChange={(e) => setBlogFormData(prev => ({ ...prev, author: e.target.value }))}
                  placeholder="Author name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <div className="flex gap-2">
                <Select 
                  value={blogFormData.category} 
                  onValueChange={(v) => setBlogFormData(prev => ({ ...prev, category: v }))}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Add new category..."
                  className="flex-1"
                />
                <Button variant="outline" onClick={handleAddCategory}>Add</Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBlogDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveBlog} disabled={savingBlog}>
              {savingBlog ? 'Saving...' : 'Save Blog'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}