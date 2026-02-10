import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function GetStarted() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
  });

  const [isPrefilled, setIsPrefilled] = useState(false);

  useEffect(() => {
    const first = sessionStorage.getItem('onboarding_firstName') ?? '';
    const last = sessionStorage.getItem('onboarding_lastName') ?? '';

    if (first.trim() || last.trim()) {
      setFormData({ firstName: first, lastName: last });
      setIsPrefilled(true);
    }
  }, []);

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
        <div className="flex items-center justify-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <span className="text-2xl font-bold text-primary-foreground">E</span>
          </div>
          <span className="text-2xl font-bold text-foreground">EasyMarketingAssist</span>
        </div>

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
                  disabled={isPrefilled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name <span className="text-destructive">*</span></Label>
                <Input
                  id="lastName"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  disabled={isPrefilled}
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
