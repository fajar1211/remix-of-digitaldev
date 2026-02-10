import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const schema = z
  .object({
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export default function ResetPassword() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const hasRecoveryContext = useMemo(() => {
    // Supabase typically adds parameters like type=recovery to the URL.
    const params = new URLSearchParams(window.location.search);
    const type = params.get("type");
    return type === "recovery" || type === "magiclink" || !!params.get("code");
  }, []);

  useEffect(() => {
    // Ensure the recovery session exists (Supabase creates a session after the user clicks the link).
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        if (!data.session) {
          toast({
            variant: "destructive",
            title: "Invalid link",
            description: "Please request a new password reset link from the sign-in page.",
          });
        }
      })
      .catch((e: any) => {
        toast({
          variant: "destructive",
          title: "Unable to continue",
          description: e?.message ?? "Unable to verify the password recovery session.",
        });
      })
      .finally(() => setChecking(false));
  }, [toast]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        const key = err.path[0];
        if (key) next[String(key)] = err.message;
      });
      setErrors(next);
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
      if (error) throw error;

      toast({
        title: "Password updated",
        description: "Please sign in using your new password.",
      });

      // (Optional) sign out to ensure the user signs in again
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Unable to update password",
        description: e?.message ?? "Unable to update your password.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4 py-12">
      <Link
        to="/auth"
        className="absolute top-6 left-6 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Login
      </Link>

      <div className="w-full max-w-md space-y-6">
        <Card className="shadow-soft">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Set new password</CardTitle>
            <CardDescription>
              {hasRecoveryContext
                ? "Create a new password for your account."
                : "If you opened this page without a reset link, please request a new one."}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={form.newPassword}
                  onChange={(e) => setForm((s) => ({ ...s, newPassword: e.target.value }))}
                  disabled={checking || submitting}
                  className={errors.newPassword ? "border-destructive" : ""}
                />
                {errors.newPassword && <p className="text-sm text-destructive">{errors.newPassword}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm((s) => ({ ...s, confirmPassword: e.target.value }))}
                  disabled={checking || submitting}
                  className={errors.confirmPassword ? "border-destructive" : ""}
                />
                {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
              </div>

              <Button type="submit" className="w-full" disabled={checking || submitting}>
                {submitting ? "Saving..." : "Update password"}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="justify-center">
            <Link to="/auth" className="text-sm text-primary hover:underline font-medium">
              Back to Login
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
