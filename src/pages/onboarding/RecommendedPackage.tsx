import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Package {
  id: string;
  name: string;
  type: string;
  description: string;
  features: string[];
  price: number;
}

export default function RecommendedPackage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [recommendedPackage, setRecommendedPackage] = useState<Package | null>(null);
  const [businessStage, setBusinessStage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      try {
        // Get business info to determine recommendation
        const { data: business } = await supabase
          .from('businesses')
          .select('stage, website_url')
          .eq('user_id', user.id)
          .maybeSingle();

        setBusinessStage(business?.stage || 'new');

        // Determine which package to recommend
        let packageType: 'starter' | 'growth' | 'website' | 'monthly' = 'starter';
        if (business?.stage === 'growing') {
          packageType = 'growth';
        } else if (business?.stage === 'new' && !business?.website_url) {
          packageType = 'website';
        }

        // Fetch the recommended package
        const { data: pkg } = await supabase
          .from('packages')
          .select('*')
          .eq('type', packageType)
          .eq('is_active', true)
          .single();

        if (pkg) {
          setRecommendedPackage({
            ...pkg,
            features: Array.isArray(pkg.features) ? pkg.features : JSON.parse(pkg.features as string || '[]'),
          });
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleStartPackage = async () => {
    if (!user || !recommendedPackage) return;
    
    setIsSubmitting(true);
    try {
      // Create user package
      const { error: packageError } = await (supabase as any).from('user_packages').insert({
        user_id: user.id,
        package_id: recommendedPackage.id,
        status: 'pending',
        duration_months: 1,
      });

      if (packageError) throw packageError;

      // Mark onboarding as completed
      const { error: businessError } = await supabase
        .from('businesses')
        .update({ onboarding_completed: true })
        .eq('user_id', user.id);

      if (businessError) throw businessError;

      toast({
        title: 'Welcome aboard!',
        description: 'Your package request is awaiting approval.',
      });

      navigate('/dashboard/user');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Finding the best package for you...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4 py-12">
      <Button
        variant="ghost"
        onClick={() => navigate(businessStage === 'growing' ? '/onboarding/setup-growing' : '/onboarding/setup-new')}
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

        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Recommended for your business</h1>
          <p className="text-muted-foreground">Based on your answers, we suggest this package</p>
        </div>

        {recommendedPackage && (
          <Card className="shadow-soft border-primary/30 overflow-hidden">
            <div className="bg-primary/10 px-6 py-3 border-b border-primary/20">
              <span className="text-sm font-medium text-primary">Best Match</span>
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">{recommendedPackage.name}</CardTitle>
              <p className="text-muted-foreground">{recommendedPackage.description}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold text-foreground">
                ${recommendedPackage.price}
                <span className="text-base font-normal text-muted-foreground"> one-time</span>
              </div>

              <ul className="space-y-3">
                {recommendedPackage.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                size="lg"
                className="w-full"
                onClick={handleStartPackage}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Setting up...' : 'Start This Package'}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                You can change your package anytime from your dashboard
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
