import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileText, Image, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function EasyMarketingAssist() {
  const [activeTab, setActiveTab] = useState('blogs');
  const [blogTitle, setBlogTitle] = useState('');
  const [blogContent, setBlogContent] = useState('');

  const handleAddBlog = () => {
    if (!blogTitle.trim()) {
      toast.error('Please enter a blog title');
      return;
    }
    // Placeholder for adding blog to main website database
    toast.success('Blog added successfully');
    setBlogTitle('');
    setBlogContent('');
  };

  const handleAddGallery = () => {
    // Placeholder for gallery upload
    toast.info('Gallery upload coming soon');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">EasyMarketingAssist</h1>
        <p className="text-muted-foreground">Manage main website content.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="blogs" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Add Blogs
          </TabsTrigger>
          <TabsTrigger value="gallery" className="flex items-center gap-2">
            <Image className="h-4 w-4" />
            Add Gallery
          </TabsTrigger>
        </TabsList>

        <TabsContent value="blogs" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Add Blog Post</CardTitle>
              <CardDescription>Add blog posts to the main website.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Blog Title</Label>
                <Input
                  placeholder="Enter blog title"
                  value={blogTitle}
                  onChange={(e) => setBlogTitle(e.target.value)}
                />
              </div>
              <div>
                <Label>Content</Label>
                <Textarea
                  placeholder="Write blog content..."
                  value={blogContent}
                  onChange={(e) => setBlogContent(e.target.value)}
                  rows={8}
                />
              </div>
              <Button onClick={handleAddBlog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Blog
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gallery" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Add to Gallery</CardTitle>
              <CardDescription>Upload images to the main website gallery.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">Drag and drop images here or click to upload</p>
                <Button variant="outline" onClick={handleAddGallery}>
                  <Plus className="h-4 w-4 mr-2" />
                  Upload Images
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
