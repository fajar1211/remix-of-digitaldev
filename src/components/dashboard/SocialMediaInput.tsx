import { Plus, Trash2, Facebook, Instagram, Linkedin, Youtube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface SocialMediaLink {
  platform: string;
  url: string;
}

interface SocialMediaInputProps {
  links: SocialMediaLink[];
  onChange: (links: SocialMediaLink[]) => void;
}

const PLATFORMS = [
  { value: 'facebook', label: 'Facebook', icon: Facebook },
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'twitter', label: 'X/Twitter' },
  { value: 'threads', label: 'Threads' },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube', icon: Youtube },
];

export function SocialMediaInput({ links, onChange }: SocialMediaInputProps) {
  const addLink = () => {
    onChange([...links, { platform: 'facebook', url: '' }]);
  };

  const removeLink = (index: number) => {
    const newLinks = links.filter((_, i) => i !== index);
    onChange(newLinks);
  };

  const updateLink = (index: number, field: 'platform' | 'url', value: string) => {
    const newLinks = [...links];
    newLinks[index] = { ...newLinks[index], [field]: value };
    onChange(newLinks);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Social Media Links</Label>
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          onClick={addLink}
          className="h-8"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>
      
      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          No social media links added. Click "Add" to add one.
        </p>
      ) : (
        <div className="space-y-3">
          {links.map((link, index) => (
            <div key={index} className="flex gap-2 items-start">
              <Select
                value={link.platform}
                onValueChange={(value) => updateLink(index, 'platform', value)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((platform) => (
                    <SelectItem key={platform.value} value={platform.value}>
                      {platform.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={link.url}
                onChange={(e) => updateLink(index, 'url', e.target.value)}
                placeholder={`https://${link.platform}.com/...`}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeLink(index)}
                className="h-10 w-10 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
