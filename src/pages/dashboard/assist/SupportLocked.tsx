import { ContactMessageForm } from "@/components/contact/ContactMessageForm";
import { Button } from "@/components/ui/button";
import { formatAssistStatusLabel } from "@/lib/assistStatus";
import { LogOut } from "lucide-react";

type Props = {
  name: string;
  email: string;
  status: string;
  onLogout: () => void;
};

export default function AssistSupportLocked({ name, email, status, onLogout }: Props) {
  const label = formatAssistStatusLabel(status);
  return (
    <div className="min-h-[100dvh] bg-background overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto w-full max-w-xl space-y-4 pb-24">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Support</h1>
          <p className="text-sm text-muted-foreground">
            Your account is currently <span className="font-medium">{label}</span>. Please send a message to the admin
            to request activation.
          </p>
        </header>

        <ContactMessageForm
          source="assistant_support"
          disableNameEmail
          defaultValues={{ name, email, subject: "Request activation" }}
          wrapper="card"
        />

        <Button variant="outline" className="w-full" onClick={onLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
}
