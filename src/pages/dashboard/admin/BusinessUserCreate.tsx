import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { invokeWithAuth } from "@/lib/invokeWithAuth";
import {
  findCountryByName,
  getStatesOfCountry,
  getCitiesOfState,
  findStateByName,
} from "@/lib/locations";

type PackageRow = {
  id: string;
  name: string;
  type: string;
  price: number;
  is_active: boolean;
};

type DurationRow = {
  id: string;
  package_id: string;
  duration_months: number;
  discount_percent: number;
};

export default function AdminCreateBusinessUser() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    whatsapp: "",
    businessName: "",
    province: "",
    city: "",
    packageId: "",
    durationMonths: "",
  });

  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [durations, setDurations] = useState<DurationRow[]>([]);

  // Indonesia provinces & cities
  const indonesiaIso = "ID";
  const provinces = useMemo(() => getStatesOfCountry(indonesiaIso), []);

  const selectedProvince = useMemo(
    () => (form.province ? findStateByName(indonesiaIso, form.province) : undefined),
    [form.province]
  );

  const cities = useMemo(
    () =>
      selectedProvince
        ? getCitiesOfState(indonesiaIso, selectedProvince.isoCode).map((c) => c.name)
        : [],
    [selectedProvince]
  );

  // Load packages and durations
  useEffect(() => {
    const load = async () => {
      const [pkgRes, durRes] = await Promise.all([
        supabase.from("packages").select("id,name,type,price,is_active").eq("is_active", true).order("price"),
        supabase.from("package_durations").select("id,package_id,duration_months,discount_percent").eq("is_active", true).order("sort_order"),
      ]);
      if (pkgRes.data) setPackages(pkgRes.data as any);
      if (durRes.data) setDurations(durRes.data as any);
    };
    void load();
  }, []);

  // Filtered durations for selected package
  const filteredDurations = useMemo(
    () => durations.filter((d) => d.package_id === form.packageId),
    [durations, form.packageId]
  );

  const updateField = (key: string, value: string) => {
    setForm((p) => {
      const next = { ...p, [key]: value };
      // Reset city when province changes
      if (key === "province") next.city = "";
      // Reset duration when package changes
      if (key === "packageId") next.durationMonths = "";
      return next;
    });
  };

  const onSubmit = async () => {
    const email = form.email.trim();
    const password = form.password;

    if (!email) {
      toast({ variant: "destructive", title: "Email wajib diisi" });
      return;
    }
    if (!password || password.length < 6) {
      toast({ variant: "destructive", title: "Password minimal 6 karakter" });
      return;
    }
    if (!form.fullName.trim()) {
      toast({ variant: "destructive", title: "Nama wajib diisi" });
      return;
    }
    if (!form.province) {
      toast({ variant: "destructive", title: "Provinsi wajib dipilih" });
      return;
    }
    if (!form.city) {
      toast({ variant: "destructive", title: "Kota/Kab wajib dipilih" });
      return;
    }
    if (!form.packageId) {
      toast({ variant: "destructive", title: "Paket wajib dipilih" });
      return;
    }
    if (!form.durationMonths) {
      toast({ variant: "destructive", title: "Durasi waktu wajib dipilih" });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await invokeWithAuth("admin-create-user", {
        email,
        password,
        fullName: form.fullName.trim(),
        businessName: form.businessName.trim(),
        phone: form.whatsapp.trim(),
        province: form.province,
        city: form.city,
        packageId: form.packageId,
        durationMonths: Number(form.durationMonths),
      });

      if (error) throw error;

      toast({
        title: "Berhasil dibuat",
        description: `Akun bisnis berhasil dibuat: ${email}`,
      });

      navigate("/dashboard/admin/business-users", { replace: true });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Gagal membuat akun",
        description: e?.message || "Terjadi kesalahan.",
      });
    } finally {
      setSaving(false);
    }
  };

  const formatDuration = (months: number) => {
    if (months >= 12) {
      const years = months / 12;
      return `${years} Tahun (${months} Bulan)`;
    }
    return `${months} Bulan`;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard/admin/business-users")}
              aria-label="Kembali"
              title="Kembali"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold text-foreground">Tambah Bisnis Baru</h1>
          </div>
          <p className="text-sm text-muted-foreground">Buat akun bisnis baru (bisa langsung login).</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button type="button" onClick={onSubmit} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </header>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informasi Akun</CardTitle>
          <CardDescription>Email dan password untuk login.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              placeholder="user@company.com"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password <span className="text-destructive">*</span></Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => updateField("password", e.target.value)}
              placeholder="Minimal 6 karakter"
              autoComplete="new-password"
            />
          </div>
        </CardContent>
      </Card>

      {/* Personal & Business Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informasi Pribadi & Bisnis</CardTitle>
          <CardDescription>Nama, kontak, dan informasi bisnis.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nama <span className="text-destructive">*</span></Label>
            <Input
              id="fullName"
              value={form.fullName}
              onChange={(e) => updateField("fullName", e.target.value)}
              placeholder="Nama lengkap"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="whatsapp">No. WhatsApp <span className="text-destructive">*</span></Label>
            <Input
              id="whatsapp"
              value={form.whatsapp}
              onChange={(e) => updateField("whatsapp", e.target.value)}
              placeholder="e.g. +62812..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="businessName">Nama Bisnis <span className="text-muted-foreground text-xs">(opsional)</span></Label>
            <Input
              id="businessName"
              value={form.businessName}
              onChange={(e) => updateField("businessName", e.target.value)}
              placeholder="Nama bisnis"
            />
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lokasi</CardTitle>
          <CardDescription>Provinsi dan Kota/Kabupaten di Indonesia.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Provinsi <span className="text-destructive">*</span></Label>
            <Select value={form.province} onValueChange={(v) => updateField("province", v)}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Pilih provinsi" />
              </SelectTrigger>
              <SelectContent className="bg-popover border z-50 max-h-[300px]">
                {provinces.map((p) => (
                  <SelectItem key={p.isoCode} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Kota/Kabupaten <span className="text-destructive">*</span></Label>
            <Select
              value={form.city}
              onValueChange={(v) => updateField("city", v)}
              disabled={!form.province}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder={form.province ? "Pilih kota/kabupaten" : "Pilih provinsi dulu"} />
              </SelectTrigger>
              <SelectContent className="bg-popover border z-50 max-h-[300px]">
                {cities.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Package & Duration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paket & Durasi</CardTitle>
          <CardDescription>Pilih paket dan durasi waktu langganan.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Paket <span className="text-destructive">*</span></Label>
            <Select value={form.packageId} onValueChange={(v) => updateField("packageId", v)}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Pilih paket" />
              </SelectTrigger>
              <SelectContent className="bg-popover border z-50">
                {packages.map((pkg) => (
                  <SelectItem key={pkg.id} value={pkg.id}>
                    {pkg.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Durasi Waktu <span className="text-destructive">*</span></Label>
            <Select
              value={form.durationMonths}
              onValueChange={(v) => updateField("durationMonths", v)}
              disabled={!form.packageId}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder={form.packageId ? "Pilih durasi" : "Pilih paket dulu"} />
              </SelectTrigger>
              <SelectContent className="bg-popover border z-50">
                {filteredDurations.map((d) => (
                  <SelectItem key={d.id} value={String(d.duration_months)}>
                    {formatDuration(d.duration_months)}
                    {d.discount_percent > 0 ? ` — Diskon ${d.discount_percent}%` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
