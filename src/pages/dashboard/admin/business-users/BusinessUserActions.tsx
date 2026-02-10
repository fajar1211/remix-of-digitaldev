import { useMemo, useState } from "react";
import { CircleCheck, Clock, Eye, KeyRound, Mail, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

async function getAccessToken() {
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) throw sessionErr;

  // If session is missing/expired, attempt a refresh once.
  if (!sessionData.session) {
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr) throw refreshErr;
    if (!refreshed.session?.access_token) throw new Error("Unauthorized: session not found");
    return refreshed.session.access_token;
  }

  return sessionData.session.access_token;
}

async function invokeWithAuth<T>(fnName: string, body: unknown) {
  const token = await getAccessToken();
  return supabase.functions.invoke<T>(fnName, {
    body,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

type Props = {
  userId: string;
  email: string;
  paymentActive: boolean;
  accountStatus: "pending" | "approved" | "active" | "suspended" | "expired";
  onView?: () => void;
  onDeleted?: () => void;
  onUpdated?: () => void;
};

export function BusinessUserActions({ userId, email, paymentActive, accountStatus, onView, onDeleted, onUpdated }: Props) {
  const { toast } = useToast();
  const [sendingReset, setSendingReset] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [sendingEmailChange, setSendingEmailChange] = useState(false);
  const [currentAuthEmail, setCurrentAuthEmail] = useState<string | null>(null);
  const [pendingAuthEmail, setPendingAuthEmail] = useState<string | null>(null);
  const [loadingAuthEmail, setLoadingAuthEmail] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState(false);

  const canTrigger = useMemo(() => Boolean(userId) && Boolean(email && email !== "—"), [email, userId]);

  const isPending = accountStatus === "pending";

  const nextPaymentActive = !paymentActive;

  const accountStatusLabel = paymentActive ? "Active" : "Pending";
  const nextAccountStatusLabel = nextPaymentActive ? "Active" : "Pending";

  const handleView = () => {
    onView?.();
  };

  const onConfirmTogglePayment = async () => {
    if (!userId) return;
    setUpdatingPayment(true);
    try {
      const { data, error } = await invokeWithAuth("admin-set-payment-active", {
        user_id: userId,
        payment_active: nextPaymentActive,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error(String((data as any).error));

      // When toggling to Active, also set account_status=active.
      // When toggling back to Pending, keep it as approved (not pending), to match the workflow.
      const nextAccountStatus = nextPaymentActive ? "active" : "approved";
      const { data: stData, error: stError } = await invokeWithAuth("admin-set-account-status", {
        user_id: userId,
        account_status: nextAccountStatus,
      });
      if (stError) throw stError;
      if ((stData as any)?.error) throw new Error(String((stData as any).error));

      toast({
        title: `Business Account: ${nextPaymentActive ? "Active" : "Approved"}`,
        description: nextPaymentActive
          ? "User now has full access to the dashboard."
          : "User is approved but still pending activation.",
      });

      setPaymentDialogOpen(false);
      onUpdated?.();
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Failed",
        description: e?.message ?? "Could not update payment status.",
      });
    } finally {
      setUpdatingPayment(false);
    }
  };

  const onApprove = async () => {
    if (!userId) return;
    setUpdatingPayment(true);
    try {
      const { data, error } = await invokeWithAuth("admin-set-account-status", {
        user_id: userId,
        account_status: "approved",
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error(String((data as any).error));

      toast({
        title: "User approved",
        description: "Actions are now available. Click the status icon to activate the account.",
      });

      onUpdated?.();
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Failed",
        description: e?.message ?? "Could not approve user.",
      });
    } finally {
      setUpdatingPayment(false);
    }
  };

  const openEmailDialog = async () => {
    setEmailOpen(true);

    if (!userId) return;
    setLoadingAuthEmail(true);
    try {
      const { data, error } = await invokeWithAuth("admin-account-actions", {
        action: "get_user_email",
        user_id: userId,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error(String((data as any).error));

      setCurrentAuthEmail((data as any)?.email ?? null);
      setPendingAuthEmail((data as any)?.pending_email ?? null);
    } catch {
      // Fallback to the email we already have from app tables.
      setCurrentAuthEmail(null);
      setPendingAuthEmail(null);
    } finally {
      setLoadingAuthEmail(false);
    }
  };

  const onResetPassword = async () => {
    if (!email || email === "—") return;
    setSendingReset(true);
    try {
      const { data, error } = await invokeWithAuth("admin-account-actions", {
        action: "reset_password",
        email,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error(String((data as any).error));

      toast({
        title: "Password reset sent",
        description: `A password reset link has been sent to ${email}.`,
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Failed",
        description: e?.message ?? "Could not send password reset email.",
      });
    } finally {
      setSendingReset(false);
    }
  };

  const onSubmitChangeEmail = async () => {
    const next = newEmail.trim();
    if (!next) return;

    setSendingEmailChange(true);
    try {
      const { data, error } = await invokeWithAuth("admin-account-actions", {
        action: "change_email",
        user_id: userId,
        new_email: next,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error(String((data as any).error));

      toast({
        title: "Email change requested",
        description: `A confirmation email was sent to ${next}.`,
      });
      setEmailOpen(false);
      setNewEmail("");
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Failed",
        description: e?.message ?? "Could not send email change confirmation.",
      });
    } finally {
      setSendingEmailChange(false);
    }
  };

  const onDeleteUser = async () => {
    if (!userId) return;
    if (deleteConfirm.trim().toUpperCase() !== "DELETE") return;

    setDeleting(true);
    try {
      const { data, error } = await invokeWithAuth("admin-account-actions", {
        action: "delete_user",
        user_id: userId,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error(String((data as any).error));

      toast({
        title: "Account deleted",
        description: "Auth user and all related data have been deleted.",
      });
      setDeleteOpen(false);
      setDeleteConfirm("");
      onDeleted?.();
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Failed",
        description: e?.message ?? "Could not delete account.",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {isPending ? (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void onApprove()} disabled={!userId || updatingPayment}>
            {updatingPayment ? "Approving..." : "Approve"}
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            title="View"
            type="button"
            onClick={handleView}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      ) : (
      <div className="flex items-center justify-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title={`Business Account ${accountStatusLabel}`}
          onClick={() => setPaymentDialogOpen(true)}
          disabled={!userId || updatingPayment}
        >
          {paymentActive ? (
            <CircleCheck className="h-4 w-4 text-success" />
          ) : (
            <Clock className="h-4 w-4 text-destructive" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Reset Password"
          onClick={onResetPassword}
          disabled={!canTrigger || sendingReset || sendingEmailChange}
        >
          <KeyRound className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Reset Email"
          onClick={openEmailDialog}
          disabled={!canTrigger || sendingReset || sendingEmailChange}
        >
          <Mail className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Delete"
          onClick={() => setDeleteOpen(true)}
          disabled={!userId || sendingReset || sendingEmailChange || deleting}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>

        <Button variant="outline" size="icon" className="h-8 w-8" title="View" type="button" onClick={handleView}>
          <Eye className="h-4 w-4" />
        </Button>
      </div>
      )}

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Email</DialogTitle>
            <DialogDescription>Enter the new email. Supabase will send a confirmation email before the account email changes.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor={`new-email-${userId}`}>New email</Label>
            <Input
              id={`new-email-${userId}`}
              type="email"
              placeholder="nama@domain.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              disabled={sendingEmailChange}
            />
            <p className="text-xs text-muted-foreground">
              Current email: {loadingAuthEmail ? "Loading..." : currentAuthEmail ?? email}
              {pendingAuthEmail ? (
                <span className="block">Pending new email: {pendingAuthEmail}</span>
              ) : null}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)} disabled={sendingEmailChange}>
              Cancel
            </Button>
            <Button onClick={onSubmitChangeEmail} disabled={sendingEmailChange || !newEmail.trim()}>
              {sendingEmailChange ? "Sending..." : "Send confirmation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Business Account Status?</AlertDialogTitle>
            <AlertDialogDescription>
              Set Business Account to <span className="font-medium">{nextAccountStatusLabel}</span> for this user. {" "}
              {nextPaymentActive
                ? "Active gives full access to all /dashboard/user menus."
                : "Approved keeps access limited (activation required)."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={updatingPayment}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void onConfirmTogglePayment();
              }}
              disabled={updatingPayment}
            >
              {updatingPayment ? "Updating..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the user in Supabase Authentication and all related data (profiles, businesses, roles, and activity).
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label htmlFor={`delete-confirm-${userId}`}>Type DELETE to confirm</Label>
            <Input
              id={`delete-confirm-${userId}`}
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              disabled={deleting}
            />
            <p className="text-xs text-muted-foreground">Target: {currentAuthEmail ?? email}</p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Keep dialog open while we run deletion.
                e.preventDefault();
                if (deleteConfirm.trim().toUpperCase() !== "DELETE") return;
                void onDeleteUser();
              }}
              disabled={deleting || deleteConfirm.trim().toUpperCase() !== "DELETE"}
            >
              <span className="sr-only">Confirm delete</span>
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
