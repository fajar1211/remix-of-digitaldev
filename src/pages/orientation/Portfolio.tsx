import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Link as LinkIcon, Facebook, Instagram, Youtube, Linkedin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const SOCIAL_PLATFORMS = [
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin, placeholder: 'https://linkedin.com/in/yourprofile' },
  { key: 'facebook', label: 'Facebook', icon: Facebook, placeholder: 'https://facebook.com/yourprofile' },
  { key: 'instagram', label: 'Instagram', icon: Instagram, placeholder: 'https://instagram.com/yourprofile' },
  { key: 'youtube', label: 'YouTube', icon: Youtube, placeholder: 'https://youtube.com/@yourchannel' },
  { key: 'tiktok', label: 'TikTok', icon: LinkIcon, placeholder: 'https://tiktok.com/@yourprofile' },
  { key: 'other', label: 'Other', icon: LinkIcon, placeholder: 'https://yourwebsite.com' },
];

export default function OrientationPortfolio() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({
    linkedin: '',
    facebook: '',
    instagram: '',
    youtube: '',
    tiktok: '',
    other: '',
  });

  // Load from sessionStorage on mount
  useEffect(() => {
    const savedPortfolio = sessionStorage.getItem('orientation_portfolio');
    const savedSocialLinks = sessionStorage.getItem('orientation_socialLinks');
    if (savedPortfolio) setPortfolioUrl(savedPortfolio);
    if (savedSocialLinks) setSocialLinks(JSON.parse(savedSocialLinks));
  }, []);

  const handleFinish = async () => {
    if (!user) {
      toast.error('You must be logged in');
      return;
    }

    setSaving(true);

    try {
      // Gather all data from sessionStorage
      const firstName = sessionStorage.getItem('orientation_firstName') || '';
      const lastName = sessionStorage.getItem('orientation_lastName') || '';
      const age = sessionStorage.getItem('orientation_age') || '';
      const phone = sessionStorage.getItem('orientation_phone') || '';
      const country = sessionStorage.getItem('orientation_country') || '';
      const state = sessionStorage.getItem('orientation_state') || '';
      const city = sessionStorage.getItem('orientation_city') || '';
      const skills = JSON.parse(sessionStorage.getItem('orientation_skills') || '[]');
      const experience = sessionStorage.getItem('orientation_experience') || '';

      // Format social links as array for database
      const socialLinksArray = Object.entries(socialLinks)
        .filter(([_, url]) => url.trim())
        .map(([platform, url]) => ({ platform, url: url.trim() }));

      // Update profile - cast to handle extended fields
      const updateData = {
        name: `${firstName} ${lastName}`.trim(),
        phone,
        country,
        state,
        city,
        age: age ? parseInt(age) : null,
        skills,
        experience,
        portfolio_url: portfolioUrl.trim() || null,
        social_links: socialLinksArray,
        onboarding_completed: true,
      } as Record<string, unknown>;

      const { error: profileError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Clear sessionStorage
      sessionStorage.removeItem('orientation_firstName');
      sessionStorage.removeItem('orientation_lastName');
      sessionStorage.removeItem('orientation_age');
      sessionStorage.removeItem('orientation_phone');
      sessionStorage.removeItem('orientation_country');
      sessionStorage.removeItem('orientation_state');
      sessionStorage.removeItem('orientation_city');
      sessionStorage.removeItem('orientation_skills');
      sessionStorage.removeItem('orientation_experience');
      sessionStorage.removeItem('orientation_portfolio');
      sessionStorage.removeItem('orientation_socialLinks');

      toast.success('Profile completed successfully!');
      navigate('/dashboard/assist');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updateSocialLink = (key: string, value: string) => {
    setSocialLinks(prev => ({ ...prev, [key]: value }));
    // Save to sessionStorage
    const newLinks = { ...socialLinks, [key]: value };
    sessionStorage.setItem('orientation_socialLinks', JSON.stringify(newLinks));
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4 py-12">
      <Button
        variant="ghost"
        onClick={() => navigate('/orientation/skills')}
        className="absolute top-6 left-6 flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <div className="w-full max-w-lg space-y-8 animate-fade-in">
        {/* Progress indicator */}
        <div className="flex justify-center gap-2">
          <div className="h-2 w-8 rounded-full bg-primary" />
          <div className="h-2 w-8 rounded-full bg-primary" />
          <div className="h-2 w-8 rounded-full bg-primary" />
        </div>

        <Card className="shadow-soft">
          <CardHeader className="text-center">
            <div className="text-sm font-medium text-primary mb-2">STEP 3</div>
            <CardTitle className="text-2xl">Portfolio & Social Media</CardTitle>
            <CardDescription>
              Share your portfolio and social profiles (optional)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Portfolio URL */}
            <div className="space-y-2">
              <Label htmlFor="portfolio">Portfolio URL</Label>
              <Input
                id="portfolio"
                placeholder="Website / Google Drive / Notion / GitHub"
                value={portfolioUrl}
                onChange={(e) => {
                  setPortfolioUrl(e.target.value);
                  sessionStorage.setItem('orientation_portfolio', e.target.value);
                }}
              />
              <p className="text-xs text-muted-foreground">Optional - Share your work samples</p>
            </div>

            {/* Social Media Links */}
            <div className="space-y-3">
              <Label>Social Media URLs</Label>
              <div className="space-y-3">
                {SOCIAL_PLATFORMS.map((platform) => {
                  const Icon = platform.icon;
                  return (
                    <div key={platform.key} className="flex items-center gap-2">
                      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-muted">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <Input
                        placeholder={platform.placeholder}
                        value={socialLinks[platform.key]}
                        onChange={(e) => updateSocialLink(platform.key, e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <Button
              size="lg"
              className="w-full mt-6"
              onClick={handleFinish}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Saving...
                </>
              ) : (
                'Finish'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
