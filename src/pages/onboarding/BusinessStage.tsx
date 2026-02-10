import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Rocket, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type BusinessStageType = 'new' | 'growing';

export default function BusinessStage() {
  const [selected, setSelected] = useState<BusinessStageType | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = (sessionStorage.getItem('onboarding_businessStage') as BusinessStageType | null) ?? null;
    if (stored === 'new' || stored === 'growing') setSelected(stored);
  }, []);

  const handleContinue = () => {
    if (selected) {
      // Store the selection for package filtering in step 4
      sessionStorage.setItem('onboarding_businessStage', selected);
      navigate('/onboarding/business-basics');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4 py-12">
      <Button
        variant="ghost"
        onClick={() => navigate('/onboarding/get-started')}
        className="absolute top-6 left-6 flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <div className="w-full max-w-lg space-y-8 animate-fade-in">
        {/* Progress indicator */}
        <div className="flex justify-center gap-2">
          <div className="h-2 w-8 rounded-full bg-primary" />
          <div className="h-2 w-8 rounded-full bg-muted" />
          <div className="h-2 w-8 rounded-full bg-muted" />
          <div className="h-2 w-8 rounded-full bg-muted" />
        </div>

        <Card className="shadow-soft">
          <CardHeader className="text-center">
            <div className="text-sm font-medium text-primary mb-2">STEP 1</div>
            <CardTitle className="text-2xl">Which best describes your business?</CardTitle>
            <CardDescription>
              This helps us recommend the right services for you
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* New Business Option */}
            <button
              onClick={() => setSelected('new')}
              className={cn(
                "w-full flex items-start gap-4 p-5 rounded-xl border-2 transition-all text-left",
                selected === 'new'
                  ? "border-primary bg-primary/5"
                  : "border-muted hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <div className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg",
                selected === 'new' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">I'm starting a new business</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Setting up online presence, getting first customers
                </p>
              </div>
            </button>

            {/* Growing Business Option */}
            <button
              onClick={() => setSelected('growing')}
              className={cn(
                "w-full flex items-start gap-4 p-5 rounded-xl border-2 transition-all text-left",
                selected === 'growing'
                  ? "border-primary bg-primary/5"
                  : "border-muted hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <div className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg",
                selected === 'growing' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                <Rocket className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">My business is already running</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Looking to grow, improve marketing, get more leads
                </p>
              </div>
            </button>

            <Button
              size="lg"
              className="w-full mt-6"
              disabled={!selected}
              onClick={handleContinue}
            >
              Continue
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
