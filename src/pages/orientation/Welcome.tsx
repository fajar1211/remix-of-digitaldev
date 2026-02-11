import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BrandHeader } from '@/components/layout/BrandHeader';

export default function OrientationWelcome() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4 py-12">
      <div className="w-full max-w-lg space-y-8 animate-fade-in text-center">
        {/* Logo */}
        <BrandHeader />

        <Card className="shadow-soft border-primary/20">
          <CardContent className="pt-8 pb-8 px-8 space-y-6">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Briefcase className="h-8 w-8 text-primary" />
              </div>
            </div>
            
            <div className="space-y-3">
              <h1 className="text-3xl font-bold text-foreground">Welcome, Assistant!</h1>
              <p className="text-lg text-muted-foreground">
                Let's complete your assistant profile so you can start working right away.
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              ⏱️ It only takes about 1–2 minutes
            </p>

            <Button asChild size="lg" className="w-full">
              <Link to="/orientation/profile">
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
