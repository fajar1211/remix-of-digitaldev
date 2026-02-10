import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/hooks/useI18n";

type PaymentConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amountUsdFormatted: string;
  disabled: boolean;
  confirming: boolean;
  onConfirm: () => void | Promise<void>;
  triggerText?: string;
  confirmText?: string;
  note?: string;
};

export function PaymentConfirmDialog({
  open,
  onOpenChange,
  amountUsdFormatted,
  disabled,
  confirming,
  onConfirm,
  triggerText,
  confirmText,
  note,
}: PaymentConfirmDialogProps) {
  const { t } = useI18n();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <Button type="button" size="lg" disabled={disabled}>
          {triggerText ?? t("order.pay")}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("order.confirmPayment")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("order.amount")}: <span className="font-medium text-foreground">{amountUsdFormatted}</span>
            {note ? (
              <>
                <br />
                {note}
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={confirming}>{t("order.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void onConfirm();
            }}
            disabled={confirming || disabled}
          >
            {confirming ? t("order.processing") : (confirmText ?? t("order.confirmAndPay"))}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

