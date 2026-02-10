import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export default function SetupGrowing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    websiteUrl: '',
    gmbLink: '',
    socialMediaLinks: '',
    mainGoal: 'visibility',
  });

  const handleSubmit = async () => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      const socialLinks = formData.socialMediaLinks
        ? formData.socialMediaLinks.split(',').map(link => link.trim()).filter(Boolean)
        : [];

      const { error } = await supabase.from('businesses').upsert({
        user_id: user.id,
        stage: 'growing',
        website_url: formData.websiteUrl || null,
        gmb_link: formData.gmbLink || null,
        social_media_links: socialLinks,
        main_goal: formData.mainGoal,
        has_website: !!formData.websiteUrl,
        has_gmb: !!formData.gmbLink,
        has_social_media: socialLinks.length > 0,
        onboarding_completed: false,
      });

      if (error) throw error;
      navigate('/onboarding/recommended-package');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error saving business info',
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4 py-12">
      <Button
        variant="ghost"
        onClick={() => navigate('/onboarding/business-stage')}
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
          <div className="h-2 w-8 rounded-full bg-muted" />
        </div>

        <Card className="shadow-soft">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Tell us about your business</CardTitle>
            <CardDescription>
              Share your existing marketing assets
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="websiteUrl">Website URL</Label>
              <Input
                id="websiteUrl"
                placeholder="https://yourbusiness.com"
                value={formData.websiteUrl}
                onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gmbLink">Google Business Profile Link</Label>
              <Input
                id="gmbLink"
                placeholder="https://g.page/..."
                value={formData.gmbLink}
                onChange={(e) => setFormData({ ...formData, gmbLink: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="socialMediaLinks">Social Media Links</Label>
              <Input
                id="socialMediaLinks"
                placeholder="Separate multiple links with commas"
                value={formData.socialMediaLinks}
                onChange={(e) => setFormData({ ...formData, socialMediaLinks: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">e.g., instagram.com/you, facebook.com/you</p>
            </div>

            <div className="space-y-3 pt-2">
              <Label className="text-base">What's your main goal?</Label>
              <RadioGroup
                value={formData.mainGoal}
                onValueChange={(value) => setFormData({ ...formData, mainGoal: value })}
                className="space-y-2"
              >
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/80 transition-colors">
                  <RadioGroupItem value="visibility" id="goal-visibility" />
                  <Label htmlFor="goal-visibility" className="cursor-pointer flex-1">
                    More visibility
                    <span className="block text-xs text-muted-foreground">Get found by more potential customers</span>
                  </Label>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/80 transition-colors">
                  <RadioGroupItem value="leads" id="goal-leads" />
                  <Label htmlFor="goal-leads" className="cursor-pointer flex-1">
                    More leads
                    <span className="block text-xs text-muted-foreground">Convert visitors into customers</span>
                  </Label>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/80 transition-colors">
                  <RadioGroupItem value="content" id="goal-content" />
                  <Label htmlFor="goal-content" className="cursor-pointer flex-1">
                    Better content
                    <span className="block text-xs text-muted-foreground">Improve your marketing materials</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Button
              size="lg"
              className="w-full mt-4"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Continue'}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
