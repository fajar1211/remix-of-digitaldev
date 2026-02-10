import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Globe, MapPin, User } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { LocationSelectFields } from "@/components/location/LocationSelectFields";

type SocialLink = {
  platform: string;
  url: string;
};

type ProfileRow = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  skills: string[] | null;
  portfolio_url: string | null;
  social_links: SocialLink[] | null;
};

const socialPlatforms = [
  { value: "facebook", label: "Facebook" },
  { value: "twitter", label: "X/Twitter" },
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
] as const;

const formatAssistId = (userId: string) => {
  const idNum = (parseInt(userId.slice(-4), 16) % 900) + 100;
  return `A${String(idNum).padStart(5, "0")}`;
};

function normalizeSocialLinks(value: unknown): SocialLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((x) => {
      const obj = x as any;
      const platform = typeof obj?.platform === "string" ? obj.platform : "";
      const url = typeof obj?.url === "string" ? obj.url : "";
      if (!platform || !url) return null;
      return { platform, url } satisfies SocialLink;
    })
    .filter(Boolean) as SocialLink[];
}

function safeLink(url: string) {
  const u = (url ?? "").trim();
  if (!u) return null;
  return u.startsWith("http") ? u : `https://${u}`;
}

export default function AdminAssistantDetails() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const assistId = useMemo(() => (userId ? formatAssistId(userId) : ""), [userId]);

  useEffect(() => {
    if (!userId) return;

    (async () => {
      setLoading(true);
      try {
        const { data, error } = await (supabase as any)
          .from("profiles")
          .select("id, name, email, phone, avatar_url, country, state, city, skills, portfolio_url, social_links")
          .eq("id", userId)
          .maybeSingle();

        if (error) throw error;

        const row = (data as any) ?? null;
        if (!row) {
          setProfile(null);
          return;
        }

        setProfile({
          id: String(row.id),
          name: row.name ?? null,
          email: String(row.email ?? ""),
          phone: row.phone ?? null,
          avatar_url: row.avatar_url ?? null,
          country: row.country ?? null,
          state: row.state ?? null,
          city: row.city ?? null,
          skills: Array.isArray(row.skills) ? (row.skills as string[]) : null,
          portfolio_url: row.portfolio_url ?? null,
          social_links: normalizeSocialLinks(row.social_links),
        });
      } catch (e) {
        console.error("Error fetching assistant profile:", e);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (!userId) return null;

  const locationSchema = z.object({
    country: z.string().trim().max(100).nullable(),
    state: z.string().trim().max(100).nullable(),
    city: z.string().trim().max(100).nullable(),
  });

  const handleSaveLocation = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      const parsed = locationSchema.safeParse({
        country: profile.country ?? null,
        state: profile.state ?? null,
        city: profile.city ?? null,
      });
      if (!parsed.success) throw new Error("Invalid location values");

      const { error } = await supabase
        .from("profiles")
        .update({
          country: (profile.country ?? "").trim() || null,
          state: (profile.state ?? "").trim() || null,
          city: (profile.city ?? "").trim() || null,
        } as any)
        .eq("id", profile.id);

      if (error) throw error;

      setIsEditing(false);
      toast({ title: "Saved", description: "Location updated." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message ?? "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate("/dashboard/admin/assistants")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Profile</h1>
        </div>
        <p className="text-muted-foreground ml-10">Profile assistant (read-only).</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Your account details and portfolio</CardDescription>
              </div>
            </div>

            {!loading && profile ? (
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <Button variant="outline" onClick={() => setIsEditing(false)} disabled={saving}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveLocation} disabled={saving}>
                      {saving ? "Saving..." : "Save"}
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setIsEditing(true)}>Edit</Button>
                )}
              </div>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-8">
          {loading ? (
            <div className="py-8 text-sm text-muted-foreground">Loading profile...</div>
          ) : !profile ? (
            <div className="py-8 text-sm text-muted-foreground">Profile not found.</div>
          ) : (
            <>
              {/* Avatar */}
              <div className="flex items-center gap-6">
                <div className="relative">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={profile.avatar_url ?? undefined} />
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                      {(profile.name ?? "A").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div>
                  <h3 className="font-medium text-lg">{profile.name ?? "—"}</h3>
                  <p className="text-sm text-muted-foreground">{profile.email || "-"}</p>
                </div>
              </div>

              {/* Basic Info */}
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Assist ID</Label>
                  <Input value={assistId} disabled className="bg-muted font-mono" />
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <p className="py-2 font-medium">{profile.email || "-"}</p>
                </div>

                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={profile.name ?? ""} disabled className="bg-muted" />
                </div>

                <div className="space-y-2">
                  <Label>Phone</Label>
                  <p className="py-2 font-medium">{profile.phone || "-"}</p>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />Location
                  </Label>
                  {isEditing ? (
                    <LocationSelectFields
                      country={profile.country ?? ""}
                      state={profile.state ?? ""}
                      city={profile.city ?? ""}
                      onCountryChange={(c) =>
                        setProfile((p) =>
                          p
                            ? {
                                ...p,
                                country: c,
                                state: null,
                                city: null,
                              }
                            : p,
                        )
                      }
                      onStateChange={(s) =>
                        setProfile((p) => (p ? { ...p, state: s, city: null } : p))
                      }
                      onCityChange={(c) => setProfile((p) => (p ? { ...p, city: c } : p))}
                      className="grid gap-6 md:grid-cols-3"
                    />
                  ) : (
                    <div className="grid gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Country:</span>{" "}
                        <span className="font-medium">{profile.country || "-"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">State:</span>{" "}
                        <span className="font-medium">{profile.state || "-"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">City:</span>{" "}
                        <span className="font-medium">{profile.city || "-"}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Skills</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(profile.skills ?? []).length ? (
                    (profile.skills ?? []).map((skill) => (
                      <Badge key={skill} variant="secondary" className="flex items-center gap-1">
                        {skill}
                      </Badge>
                    ))
                  ) : (
                    <p className="py-2 text-muted-foreground">-</p>
                  )}
                </div>
              </div>

              {/* Portfolio */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />Portfolio URL
                </Label>
                {profile.portfolio_url ? (
                  <a
                    href={safeLink(profile.portfolio_url) ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2 text-primary hover:underline flex items-center gap-2"
                  >
                    {profile.portfolio_url}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <p className="py-2 text-muted-foreground">-</p>
                )}
              </div>

              {/* Social Media */}
              <div className="space-y-2">
                <Label>Social Media</Label>
                <div className="space-y-2">
                  {(profile.social_links ?? []).length ? (
                    (profile.social_links ?? []).map((link, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                        <Badge variant="outline">
                          {socialPlatforms.find((p) => p.value === link.platform)?.label || link.platform}
                        </Badge>
                        <a
                          href={safeLink(link.url) ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 text-sm text-primary hover:underline flex items-center gap-1"
                        >
                          {link.url}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    ))
                  ) : (
                    <p className="py-2 text-muted-foreground">-</p>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
