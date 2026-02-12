import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BrandHeader } from '@/components/layout/BrandHeader';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function GetStarted() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
  });

  const [isPrefilled, setIsPrefilled] = useState(false);

  useEffect(() => {
    // First try sessionStorage
    const first = sessionStorage.getItem('onboarding_firstName') ?? '';
    const last = sessionStorage.getItem('onboarding_lastName') ?? '';

    if (first.trim() || last.trim()) {
      setFormData({ firstName: first, lastName: last });
      setIsPrefilled(true);
      return;
    }

    // Then try DB (admin may have pre-filled via admin-create-user)
    if (!user) return;
    const prefill = async () => {
      const { data } = await (supabase as any)
        .from('businesses')
        .select('first_name, last_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data && (data.first_name || data.last_name)) {
        const fn = data.first_name ?? '';
        const ln = data.last_name ?? '';
        setFormData({ firstName: fn, lastName: ln });
        setIsPrefilled(true);
        sessionStorage.setItem('onboarding_firstName', fn);
        sessionStorage.setItem('onboarding_lastName', ln);
      }
    };
    void prefill();
  }, [user]);

  const isFormValid = formData.firstName.trim() && formData.lastName.trim();

  const handleContinue = () => {
    // Store in sessionStorage for use in later steps
    sessionStorage.setItem('onboarding_firstName', formData.firstName.trim());
    sessionStorage.setItem('onboarding_lastName', formData.lastName.trim());
    navigate('/onboarding/business-stage');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4 py-12">
      <div className="w-full max-w-lg space-y-8 animate-fade-in text-center">
        {/* Logo */}
        <BrandHeader />

        <Card className="shadow-soft border-primary/20">
          <CardContent className="pt-8 pb-8 px-8 space-y-6">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
            </div>
            
            <div className="space-y-3">
              <h1 className="text-3xl font-bold text-foreground">Let's get started</h1>
              <p className="text-sm text-muted-foreground">
                Tell us your name to personalize your experience
              </p>
            </div>

            <div className="space-y-4 text-left">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name <span className="text-destructive">*</span></Label>
                <Input
                  id="firstName"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name <span className="text-destructive">*</span></Label>
                <Input
                  id="lastName"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
              </div>
            </div>

            <Button
              size="lg"
              className="w-full"
              disabled={!isFormValid}
              onClick={handleContinue}
            >
              Continue
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
