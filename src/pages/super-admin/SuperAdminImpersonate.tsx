import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function SuperAdminImpersonate() {
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = params.get("token");
  const redirectTo = params.get("redirect_to");

  useEffect(() => {
    (async () => {
      try {
        if (!token || !redirectTo) {
          throw new Error("Missing token or redirect_to.");
        }

        // Prevent open-redirect: only allow redirect within current origin
        if (!redirectTo.startsWith(window.location.origin)) {
          throw new Error("Invalid redirect_to.");
        }

        const { error } = await supabase.auth.verifyOtp({
          type: "magiclink",
          token_hash: token,
        });

        if (error) throw error;

        // Navigate to the target dashboard (includes ?imp=... for bypass checks)
        window.location.assign(redirectTo);
      } catch (e: any) {
        const msg = e?.message || "Failed to log in as the target account.";
        console.error(e);
        toast.error(msg);
        setFatalError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [redirectTo, token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Logging in as target account</CardTitle>
          <CardDescription>
            {loading ? "Processing..." : fatalError ? "Failed" : "Done"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Please wait, redirecting...</p>
          ) : fatalError ? (
            <>
              <p className="text-sm text-destructive">{fatalError}</p>
              <div className="flex gap-2">
                <Button asChild variant="outline">
                  <Link to="/dashboard/super-admin/users-assists">Back</Link>
                </Button>
              </div>
            </>
          ) : (
            <Button asChild>
              <a href={redirectTo ?? "/dashboard/super-admin/users-assists"}>Continue</a>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
