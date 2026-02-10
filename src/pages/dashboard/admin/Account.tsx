import { useMemo, useState } from "react";
import { z } from "zod";
import { Eye, EyeOff, Lock, Mail, ShieldAlert } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const passwordSchema = z
  .object({
    newPassword: z.string().min(6, "Must be at least 6 characters").max(128, "Must be 128 characters or fewer"),
    confirmPassword: z.string().min(1, "This field is required"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Password confirmation does not match",
    path: ["confirmPassword"],
  });

const emailSchema = z.object({
  newEmail: z.string().trim().email("Invalid email address").max(255, "Must be 255 characters or fewer"),
});

async function trySendSecurityEmail(payload: unknown) {
  // Best effort: if not configured, the UI should still work.
  const { error } = await supabase.functions.invoke("admin-security-notify", {
    body: payload,
  });
  return { error };
}

export default function AdminAccount() {
  const { user } = useAuth();
  const { toast } = useToast();

  const currentEmail = user?.email ?? "";

  const [changingPassword, setChangingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });

  const [changingEmail, setChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  const passwordErrors = useMemo(() => {
    const parsed = passwordSchema.safeParse(passwordForm);
    if (parsed.success) return {} as Record<string, string>;

    const map: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path?.[0] ?? "form");
      map[key] = issue.message;
    }
    return map;
  }, [passwordForm]);

  const emailErrors = useMemo(() => {
    const parsed = emailSchema.safeParse({ newEmail });
    if (parsed.success) return {} as Record<string, string>;

    const map: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path?.[0] ?? "form");
      map[key] = issue.message;
    }
    return map;
  }, [newEmail]);

  const handleChangePassword = async () => {
    const parsed = passwordSchema.safeParse(passwordForm);
    if (!parsed.success) {
      toast({ variant: "destructive", title: "Validation failed", description: "Please review the password fields." });
      return;
    }

    if (!currentEmail) {
      toast({ variant: "destructive", title: "Error", description: "The current admin email address could not be found." });
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
      if (error) throw error;

      // Notify the current admin email (best effort)
      const { error: notifyErr } = await trySendSecurityEmail({
        type: "password_changed",
        to: currentEmail,
      });

      setPasswordForm({ newPassword: "", confirmPassword: "" });

      toast({
        title: "Password updated",
        description: notifyErr
          ? "Your password was updated; however, email notifications are not yet enabled (Resend configuration required)."
          : "Your password was updated and a notification email has been sent.",
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Unable to update password", description: e?.message ?? "Unknown error" });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleChangeEmail = async () => {
    const parsed = emailSchema.safeParse({ newEmail });
    if (!parsed.success) {
      toast({ variant: "destructive", title: "Validation failed", description: "The new email address is invalid." });
      return;
    }

    if (!currentEmail) {
      toast({ variant: "destructive", title: "Error", description: "The current admin email address could not be found." });
      return;
    }

    if (parsed.data.newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      toast({ variant: "destructive", title: "No changes detected", description: "The new email matches the current email." });
      return;
    }

    setChangingEmail(true);
    try {
      // Supabase will send a confirmation email to the new address (per Auth settings).
      const { error } = await supabase.auth.updateUser({ email: parsed.data.newEmail });
      if (error) throw error;

      // Notify the old email address (best effort)
      const { error: notifyErr } = await trySendSecurityEmail({
        type: "email_change_requested",
        to: currentEmail,
        oldEmail: currentEmail,
        newEmail: parsed.data.newEmail,
      });

      toast({
        title: "Email change requested",
        description: notifyErr
          ? "Please check your new email address for the confirmation link. Notifications to the old email are not yet enabled (Resend configuration required)."
          : "Please check your new email address for the confirmation link. A notification has also been sent to your old email address.",
      });

      setNewEmail("");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Unable to change email", description: e?.message ?? "Unknown error" });
    } finally {
      setChangingEmail(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">My Account</h1>
        <p className="text-muted-foreground">Manage the admin account (email and password).</p>
      </div>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Note</AlertTitle>
        <AlertDescription>
          Email notifications via Resend will become available once the Resend key is configured. You can still use this
          page to update email and password.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Email</CardTitle>
              <CardDescription>Change your email using Supabase confirmation and notify the old address.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Current email</Label>
            <Input value={currentEmail} disabled className="bg-muted" />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="newEmail">New email</Label>
            <Input
              id="newEmail"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="nama@domain.com"
              autoComplete="email"
            />
            {emailErrors.newEmail && <p className="text-sm text-destructive">{emailErrors.newEmail}</p>}
            <p className="text-xs text-muted-foreground">After submitting, check your new email for the confirmation link.</p>
          </div>

          <Button onClick={handleChangeEmail} disabled={changingEmail || !newEmail || !!emailErrors.newEmail}>
            {changingEmail ? "Processing..." : "Request Email Change"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Password</CardTitle>
              <CardDescription>Update your password and notify the current admin email address.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                autoComplete="new-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowNewPassword((v) => !v)}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>
            {passwordErrors.newPassword && <p className="text-sm text-destructive">{passwordErrors.newPassword}</p>}
            <p className="text-xs text-muted-foreground">Must be at least 6 characters.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                autoComplete="new-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowConfirmPassword((v) => !v)}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>
            {passwordErrors.confirmPassword && <p className="text-sm text-destructive">{passwordErrors.confirmPassword}</p>}
          </div>

          <Button
            onClick={handleChangePassword}
            disabled={changingPassword || !passwordForm.newPassword || !passwordForm.confirmPassword || !!passwordErrors.newPassword || !!passwordErrors.confirmPassword}
          >
            {changingPassword ? "Updating..." : "Change Password"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
