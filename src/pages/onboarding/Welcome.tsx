import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Welcome() {
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
              <h1 className="text-3xl font-bold text-foreground">Welcome!</h1>
              <p className="text-lg text-muted-foreground">
                Let's set up your business in a few easy steps.
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              This will only take about 2 minutes. We'll help you choose the right marketing package for your business.
            </p>

            <Button asChild size="lg" className="w-full">
              <Link to="/onboarding/get-started">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
