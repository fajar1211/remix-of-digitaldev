import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SocialMediaInput, SocialMediaLink } from '@/components/dashboard/SocialMediaInput';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export default function OnlinePresence() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    websiteUrl: '',
    gmbLink: '',
  });
  const [socialMediaLinks, setSocialMediaLinks] = useState<SocialMediaLink[]>([]);

  useEffect(() => {
    const websiteUrl = sessionStorage.getItem('onboarding_websiteUrl') ?? '';
    const gmbLink = sessionStorage.getItem('onboarding_gmbLink') ?? '';
    const socialRaw = sessionStorage.getItem('onboarding_socialLinks') ?? '[]';
    let social: SocialMediaLink[] = [];
    try {
      const parsed = JSON.parse(socialRaw);
      if (Array.isArray(parsed)) social = parsed;
    } catch {
      // ignore
    }

    if (websiteUrl || gmbLink) {
      setFormData({ websiteUrl, gmbLink });
    }
    if (social.length > 0) setSocialMediaLinks(social);
  }, []);

  useEffect(() => {
    sessionStorage.setItem('onboarding_websiteUrl', formData.websiteUrl ?? '');
    sessionStorage.setItem('onboarding_gmbLink', formData.gmbLink ?? '');
  }, [formData.websiteUrl, formData.gmbLink]);

  useEffect(() => {
    sessionStorage.setItem('onboarding_socialLinks', JSON.stringify(socialMediaLinks ?? []));
  }, [socialMediaLinks]);

  const saveAndContinue = async (skip: boolean = false) => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'You must be logged in to continue.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Get all stored data from session
      const firstName = sessionStorage.getItem('onboarding_firstName') || '';
      const lastName = sessionStorage.getItem('onboarding_lastName') || '';
      const businessStage = sessionStorage.getItem('onboarding_businessStage') || 'new';
      const businessName = sessionStorage.getItem('onboarding_businessName') || '';
      const businessType = sessionStorage.getItem('onboarding_businessType') || '';
      const country = sessionStorage.getItem('onboarding_country') || '';
      const city = sessionStorage.getItem('onboarding_city') || '';
      const phoneNumber = sessionStorage.getItem('onboarding_phoneNumber') || '';

      // Update profile with first/last name
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: user.id,
        name: `${firstName} ${lastName}`.trim() || user.email || '',
        email: user.email || '',
        phone: phoneNumber || null,
      });

      if (profileError) {
        console.error('Profile error:', profileError);
        throw profileError;
      }

      // Prepare social media links for storage (use the correct column name)
      const socialLinksForStorage = skip ? [] : socialMediaLinks.filter(link => link.url.trim());

      // Check if business already exists
      const { data: existingBusiness } = await (supabase
        .from('businesses')
        .select('id, business_number')
        .eq('user_id', user.id)
        .maybeSingle() as any);

      // Create/update business record with correct column names
      const businessData: any = {
        user_id: user.id,
        first_name: firstName || null,
        last_name: lastName || null,
        business_name: businessName || null,
        business_type: businessType || null,
        country: country || null,
        city: city || null,
        phone_number: phoneNumber || null,
        email: user.email || null,
        stage: businessStage,
        website_url: skip ? '' : (formData.websiteUrl || ''),
        gmb_link: skip ? null : (formData.gmbLink || null),
        social_links: socialLinksForStorage as any,
        onboarding_completed: false,
      };

      let businessError;
      let businessNumber: number | null = existingBusiness?.business_number ?? null;

      if (existingBusiness) {
        // Update existing and return current business_number
        const { data: updatedBusiness, error } = await (supabase
          .from('businesses')
          .update(businessData)
          .eq('user_id', user.id)
          .select('business_number')
          .maybeSingle() as any);
        businessError = error;
        if (updatedBusiness?.business_number) {
          businessNumber = updatedBusiness.business_number;
        }
      } else {
        // Insert new and get generated business_number
        const { data: newBusiness, error } = await (supabase
          .from('businesses')
          .insert(businessData)
          .select('business_number')
          .maybeSingle() as any);
        businessError = error;
        if (newBusiness?.business_number) {
          businessNumber = newBusiness.business_number;
        }
      }

      if (businessError) {
        console.error('Business error:', businessError);
        throw businessError;
      }

      if (businessNumber) {
        const formattedId = `B${businessNumber.toString().padStart(5, '0')}`;
        sessionStorage.setItem('onboarding_businessId', formattedId);
      }

      // Store first/last name in sessionStorage for MyBusiness to pick up
      sessionStorage.setItem('sync_firstName', firstName);
      sessionStorage.setItem('sync_lastName', lastName);

      navigate('/onboarding/select-package');
    } catch (error: any) {
      console.error('Save error:', error);
      toast({
        variant: 'destructive',
        title: 'Error saving information',
        description: error.message || 'Something went wrong. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4 py-12">
      <Button
        variant="ghost"
        onClick={() => navigate('/onboarding/business-basics')}
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
          <div className="h-2 w-8 rounded-full bg-muted" />
        </div>

        <Card className="shadow-soft">
          <CardHeader className="text-center">
            <div className="text-sm font-medium text-primary mb-2">STEP 3</div>
            <CardTitle className="text-2xl">Online Presence</CardTitle>
            <CardDescription>
              Share your existing online presence (optional)
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
              <SocialMediaInput
                links={socialMediaLinks}
                onChange={setSocialMediaLinks}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => saveAndContinue(true)}
                disabled={isSubmitting}
              >
                <SkipForward className="mr-2 h-4 w-4" />
                Skip
              </Button>
              <Button
                size="lg"
                className="flex-1"
                onClick={() => saveAndContinue(false)}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Next Step'}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
