import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Eye, EyeOff, Lock, Mail, ShieldAlert } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const passwordSchema = z
  .object({
    newPassword: z.string().min(6, "Minimal 6 karakter").max(128, "Maksimal 128 karakter"),
    confirmPassword: z.string().min(1, "Wajib diisi"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Konfirmasi password tidak sama",
    path: ["confirmPassword"],
  });

const emailSchema = z.object({
  newEmail: z.string().trim().email("Format email tidak valid").max(255, "Maksimal 255 karakter"),
});

async function trySendSecurityEmail(payload: unknown) {
  // Best effort: kalau edge function belum dikonfigurasi, fitur update tetap jalan.
  const { error } = await supabase.functions.invoke("admin-security-notify", {
    body: payload,
  });
  return { error };
}

export default function SuperAdminMyAccount() {
  const { toast } = useToast();

  const [currentEmail, setCurrentEmail] = useState<string>("");
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingUser(true);
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;
      if (error) {
        setCurrentEmail("");
        setLoadingUser(false);
        return;
      }
      setCurrentEmail(data.user?.email ?? "");
      setLoadingUser(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [changingEmail, setChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  const [changingPassword, setChangingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });

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

  const handleChangeEmail = async () => {
    const parsed = emailSchema.safeParse({ newEmail });
    if (!parsed.success) {
      toast({ variant: "destructive", title: "Validasi gagal", description: "Email baru tidak valid." });
      return;
    }

    setChangingEmail(true);
    try {
      const { data } = await supabase.auth.getUser();
      const oldEmail = data.user?.email ?? "";

      if (!oldEmail) {
        throw new Error("Email saat ini tidak ditemukan. Silakan login ulang.");
      }

      if (parsed.data.newEmail.toLowerCase() === oldEmail.toLowerCase()) {
        toast({ variant: "destructive", title: "Tidak ada perubahan", description: "Email baru sama dengan email saat ini." });
        return;
      }

      // Supabase biasanya kirim email konfirmasi ke email baru (tergantung setting Auth).
      const { error } = await supabase.auth.updateUser({ email: parsed.data.newEmail });
      if (error) throw error;

      await trySendSecurityEmail({
        type: "email_change_requested",
        to: oldEmail,
        oldEmail,
        newEmail: parsed.data.newEmail,
      });

      toast({
        title: "Request ganti email berhasil",
        description: "Cek inbox email BARU untuk link konfirmasi dari Supabase.",
      });
      setNewEmail("");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal ganti email", description: e?.message ?? "Unknown error" });
    } finally {
      setChangingEmail(false);
    }
  };

  const handleChangePassword = async () => {
    const parsed = passwordSchema.safeParse(passwordForm);
    if (!parsed.success) {
      toast({ variant: "destructive", title: "Validasi gagal", description: "Periksa field password." });
      return;
    }

    setChangingPassword(true);
    try {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email ?? "";

      if (!data.user) throw new Error("User tidak ditemukan. Silakan login ulang.");

      const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
      if (error) throw error;

      if (email) {
        await trySendSecurityEmail({ type: "password_changed", to: email });
      }

      toast({ title: "Password berhasil diubah", description: "Silakan gunakan password baru saat login berikutnya." });
      setPasswordForm({ newPassword: "", confirmPassword: "" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal ganti password", description: e?.message ?? "Unknown error" });
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">My Account</h1>
        <p className="text-muted-foreground">Ganti email dan password untuk akun Super Admin.</p>
      </div>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Catatan</AlertTitle>
        <AlertDescription>
          Untuk ganti email, Supabase biasanya akan mengirim <b>link konfirmasi</b> ke email baru (sesuai pengaturan Auth).
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
              <CardDescription>Ganti email login Super Admin (perlu konfirmasi).</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email saat ini</Label>
            <Input value={loadingUser ? "Loading..." : currentEmail || "—"} disabled className="bg-muted" />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="newEmail">Email baru</Label>
            <Input
              id="newEmail"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="nama@domain.com"
              autoComplete="email"
            />
            {emailErrors.newEmail ? <p className="text-sm text-destructive">{emailErrors.newEmail}</p> : null}
            <p className="text-xs text-muted-foreground">Setelah submit, cek inbox email baru untuk link konfirmasi.</p>
          </div>

          <Button onClick={handleChangeEmail} disabled={changingEmail || !newEmail || !!emailErrors.newEmail}>
            {changingEmail ? "Memproses..." : "Request Ganti Email"}
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
              <CardDescription>Update password login Super Admin.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">Password baru</Label>
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
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            {passwordErrors.newPassword ? <p className="text-sm text-destructive">{passwordErrors.newPassword}</p> : null}
            <p className="text-xs text-muted-foreground">Minimal 6 karakter.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Konfirmasi password baru</Label>
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
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            {passwordErrors.confirmPassword ? (
              <p className="text-sm text-destructive">{passwordErrors.confirmPassword}</p>
            ) : null}
          </div>

          <Button
            onClick={handleChangePassword}
            disabled={
              changingPassword ||
              !passwordForm.newPassword ||
              !passwordForm.confirmPassword ||
              !!passwordErrors.newPassword ||
              !!passwordErrors.confirmPassword
            }
          >
            {changingPassword ? "Mengubah..." : "Ganti Password"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
