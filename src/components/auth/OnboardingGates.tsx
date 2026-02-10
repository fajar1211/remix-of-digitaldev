import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

/**
 * Rules (per request):
 * - If NOT logged in -> 404
 * - If already completed onboarding/orientation -> 404
 * - Only accessible for first-time (not completed yet) accounts
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (loading) return;

      // Not logged in => 404
      if (!user) {
        navigate("/404", { replace: true });
        return;
      }

      // Wrong role => 404
      if (role !== "user") {
        navigate("/404", { replace: true });
        return;
      }

      // Completed onboarding => 404
      const { data: business, error } = await supabase
        .from("businesses")
        .select("onboarding_completed")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        // If can't validate, fail closed per requirement
        navigate("/404", { replace: true });
        return;
      }

      const completed = business?.onboarding_completed ?? false;
      if (completed) {
        navigate("/404", { replace: true });
        return;
      }

      setChecking(false);
    };

    run();
  }, [loading, user, role, navigate]);

  if (loading || checking) return <LoadingScreen />;
  return <>{children}</>;
}

export function OrientationGate({ children }: { children: ReactNode }) {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (loading) return;

      // Not logged in => 404
      if (!user) {
        navigate("/404", { replace: true });
        return;
      }

      // Wrong role => 404
      if (role !== "assist") {
        navigate("/404", { replace: true });
        return;
      }

      // Completed orientation => 404
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        // Fail closed
        navigate("/404", { replace: true });
        return;
      }

      const completed = (data as any)?.onboarding_completed ?? false;
      if (completed) {
        navigate("/404", { replace: true });
        return;
      }

      setChecking(false);
    };

    run();
  }, [loading, user, role, navigate]);

  if (loading || checking) return <LoadingScreen />;
  return <>{children}</>;
}
