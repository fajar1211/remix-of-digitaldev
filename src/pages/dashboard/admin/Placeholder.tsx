import { ArrowRight, Lock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const roadmap: Record<string, string[]> = {
  Business: ["Daftar user + detail profil bisnis", "Suspend / aktifkan user", "Catatan internal user"],
  Assistant: ["Verifikasi assistant", "Aktif / nonaktif assistant", "Assign assistant ke user + workload", "Monitoring performa"],
  Tasks: ["Lihat semua task", "Assign/reassign", "Deadline + prioritas", "Monitoring status"],
  Reports: ["Review laporan", "Approve/reject", "Minta revisi", "Kirim ke user"],
  Messages: ["Inbox admin", "Filter/search", "Lampiran file", "Status read/unread"],

  Website: ["Kelola halaman website", "Blog & artikel", "Media library", "Contact", "Services", "Layout", "Support"],
  Pages: ["Daftar halaman", "Edit konten", "Publish / unpublish", "Preview"],
  Blog: ["Daftar artikel", "Editor", "Kategori & tag", "Publish"],
  "Media Library": ["Upload gambar", "Folder/label", "Optimasi gambar", "Pakai di konten"],
  Contact: ["Edit informasi kontak", "Jam operasional", "CTA WhatsApp/Email", "Maps embed"],
  Services: ["Daftar layanan", "Harga/paket", "Highlight fitur", "CTA order"],
  Layout: ["Header/footer", "Navigasi", "Komponen global", "Theme/branding"],

  "Domain Tools": [
    "Atur flow /order (step, copy, CTA)",
    "Atur aturan validasi domain (format, auto-normalize)",
    "Kaitkan harga domain ke paket (read-only dulu)",
  ],

  Analytics: ["Traffic", "Pages", "Blog Performance", "Campaign (UTM)", "Conversion (read-only)"],
  Traffic: ["Overview traffic", "Source/medium", "Device", "Tren harian"],
  "Analytics Pages": ["Top pages", "Landing pages", "Exit pages", "Time on page"],
  "Blog Performance": ["Top posts", "Engagement", "Share/click", "Tren"],
  "Campaign (UTM)": ["Daftar campaign", "UTM builder", "Performance per campaign", "Export"],
  "Conversion (read-only)": ["Funnel", "Events", "Goal completion", "Read-only view"],

  Announcements: ["Broadcast ke assistant", "Broadcast ke user", "Maintenance info"],
  "Quality Control": ["Checklist standar", "Review hasil", "Flag kualitas rendah"],
  "Activity Logs": ["Aktivitas admin", "Aktivitas assistant & user", "Filter & search"],
  "My Account": ["Ganti password", "Atur notifikasi", "Riwayat login"],
};

export default function AdminPlaceholder({ title }: { title: string }) {
  const items = roadmap[title] ?? [];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
          <Badge variant="secondary" className="gap-1">
            <Lock className="h-3.5 w-3.5" />
            Soon
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          This page is still a placeholder. Will be filled according to admin operations SOP.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Features planned for this menu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 ? (
            <div className="text-sm text-muted-foreground">Roadmap not yet defined for this page.</div>
          ) : (
            <ul className="space-y-2">
              {items.map((x) => (
                <li key={x} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <ArrowRight className="mt-0.5 h-4 w-4" />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
